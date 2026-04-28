import argparse
import csv
import json
import os
import random
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple
from urllib import error, request


DOC_ID_BY_TITLE = {
    "gio lam viec va khung gio kham": "D01",
    "chinh sach huy doi lich": "D02",
    "thanh toan qr banking": "D03",
    "bhyt va bao hiem tu nhan": "D04",
}


PREDICTION_COLUMNS = [
    "run_id",
    "query_id",
    "question",
    "gold_answer",
    "gold_doc_ids",
    "retrieved_doc_ids",
    "retrieved_titles",
    "retrieved_scores",
    "hit_at_k",
    "recall_at_k",
    "mrr",
    "context_precision",
    "context_recall",
    "faithfulness",
    "answer_relevancy",
    "retrieval_time_ms",
    "gen_time_ms",
    "latency_ms",
    "threshold",
    "num_rows",
    "k",
    "error",
]

SUMMARY_COLUMNS = [
    "run_id",
    "timestamp_utc",
    "num_rows",
    "threshold",
    "k",
    "model",
    "judge_model",
    "num_queries",
    "latency_ms",
    "retrieval_time_ms",
    "gen_time_ms",
    "context_precision",
    "context_recall",
    "faithfulness",
    "answer_relevancy",
    "hit_at_k",
    "recall_at_k",
    "mrr",
]


@dataclass
class EvalConfig:
    openai_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    embed_model: str
    chat_model: str
    judge_model: str
    k: int
    timeout_s: int


def normalize_text(text: str) -> str:
    no_diacritics = "".join(
        ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn"
    )
    return no_diacritics.lower().strip()


def to_float_or_none(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_mean(values: Sequence[Optional[float]]) -> Optional[float]:
    valid = [v for v in values if v is not None]
    if not valid:
        return None
    return sum(valid) / len(valid)


def json_dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False)


def post_json(url: str, payload: Dict[str, Any], headers: Dict[str, str], timeout_s: int) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(url=url, data=body, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return {}
            return json.loads(raw)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} calling {url}: {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Network error calling {url}: {exc}") from exc


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            items.append(json.loads(line))
    return items


def write_jsonl(path: Path, rows: Sequence[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def choose_subset_stratified(rows: Sequence[Dict[str, Any]], n: int, seed: int) -> List[Dict[str, Any]]:
    if n > len(rows):
        raise ValueError(f"Requested n={n} but only {len(rows)} rows available")

    by_type: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        key = str(row.get("question_type", "unknown"))
        by_type.setdefault(key, []).append(row)

    rng = random.Random(seed + n)
    for group_rows in by_type.values():
        rng.shuffle(group_rows)

    total = len(rows)
    target_counts: Dict[str, int] = {}
    remainders: List[Tuple[float, str]] = []
    assigned = 0
    for key, group_rows in by_type.items():
        raw = n * (len(group_rows) / total)
        count = int(raw)
        target_counts[key] = count
        assigned += count
        remainders.append((raw - count, key))

    while assigned < n:
        remainders.sort(reverse=True)
        for _, key in remainders:
            if assigned >= n:
                break
            if target_counts[key] < len(by_type[key]):
                target_counts[key] += 1
                assigned += 1

    subset: List[Dict[str, Any]] = []
    for key, group_rows in by_type.items():
        subset.extend(group_rows[: target_counts[key]])

    rng.shuffle(subset)
    for idx, row in enumerate(subset, start=1):
        row["sample_key"] = f"S{idx:04d}"
    return subset


def map_title_to_doc_id(title: str) -> Optional[str]:
    norm = normalize_text(title)
    return DOC_ID_BY_TITLE.get(norm)


def make_run_id(num_rows: int, threshold: float, k: int) -> str:
    threshold_token = f"{threshold:.2f}".replace(".", "p")
    return f"n{num_rows}_t{threshold_token}_k{k}"


def embed_text(text: str, cfg: EvalConfig) -> List[float]:
    payload = {"model": cfg.embed_model, "input": text}
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.openai_api_key}",
    }
    result = post_json("https://api.openai.com/v1/embeddings", payload, headers, cfg.timeout_s)
    data = result.get("data") or []
    if not data:
        raise RuntimeError("Embedding API returned empty data")
    emb = data[0].get("embedding")
    if not isinstance(emb, list) or not emb:
        raise RuntimeError("Embedding API returned invalid vector")
    return [float(x) for x in emb]


def retrieve_docs(question: str, threshold: float, cfg: EvalConfig) -> List[Dict[str, Any]]:
    embedding = embed_text(question, cfg)
    vector_literal = "[" + ",".join(str(x) for x in embedding) + "]"
    payload = {
        "query_embedding": vector_literal,
        "match_count": cfg.k,
        "min_similarity": threshold,
        "language_filter": "vi",
    }
    headers = {
        "Content-Type": "application/json",
        "apikey": cfg.supabase_service_role_key,
        "Authorization": f"Bearer {cfg.supabase_service_role_key}",
    }
    rpc_url = f"{cfg.supabase_url.rstrip('/')}/rest/v1/rpc/match_ai_knowledge"
    rows = post_json(rpc_url, payload, headers, cfg.timeout_s)
    if not isinstance(rows, list):
        return []
    docs: List[Dict[str, Any]] = []
    for item in rows:
        title = str(item.get("title", "")).strip()
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        similarity = to_float_or_none(item.get("similarity")) or 0.0
        docs.append(
            {
                "title": title,
                "content": content,
                "similarity": similarity,
                "doc_id": map_title_to_doc_id(title),
            }
        )
    return docs


def generate_answer(question: str, docs: Sequence[Dict[str, Any]], cfg: EvalConfig) -> str:
    context_blocks = []
    for idx, doc in enumerate(docs, start=1):
        context_blocks.append(
            f"[{idx}] title: {doc.get('title','')}\ncontent: {doc.get('content','')}"
        )
    context_text = "\n\n".join(context_blocks) if context_blocks else "(khong co context)"
    system_prompt = (
        "Ban la tro ly cho bai toan RAG danh gia. "
        "Chi tra loi dua tren context duoc cung cap. "
        "Neu context khong du, noi ro khong du thong tin va khong du doan."
    )
    user_prompt = (
        f"Cau hoi:\n{question}\n\n"
        f"Context:\n{context_text}\n\n"
        "Hay tra loi ngan gon, ro rang bang tieng Viet."
    )
    payload = {
        "model": cfg.chat_model,
        "temperature": 0.2,
        "max_tokens": 400,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.openai_api_key}",
    }
    result = post_json("https://api.openai.com/v1/chat/completions", payload, headers, cfg.timeout_s)
    choices = result.get("choices") or []
    if not choices:
        raise RuntimeError("Chat completion returned no choices")
    content = ((choices[0] or {}).get("message") or {}).get("content") or ""
    return str(content).strip()


def extract_first_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    direct = text.strip()
    if direct.startswith("```"):
        direct = re.sub(r"^```[a-zA-Z]*\s*", "", direct)
        direct = re.sub(r"\s*```$", "", direct)
    try:
        payload = json.loads(direct)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    snippet = match.group(0)
    try:
        payload = json.loads(snippet)
        return payload if isinstance(payload, dict) else None
    except json.JSONDecodeError:
        return None


def judge_answer(
    question: str,
    answer: str,
    gold_answer: str,
    docs: Sequence[Dict[str, Any]],
    cfg: EvalConfig,
) -> Tuple[Optional[float], Optional[float]]:
    context_text = "\n\n".join(
        f"- {doc.get('title','')}: {doc.get('content','')}" for doc in docs
    )
    prompt = (
        "Cham diem theo thang 0..1 va tra ve JSON dung schema:\n"
        '{"faithfulness": number, "answer_relevancy": number}\n'
        "Dinh nghia:\n"
        "- faithfulness: muc do cau tra loi trung thanh voi context.\n"
        "- answer_relevancy: muc do tra loi dung trong tam cau hoi.\n"
        "Chi tra ve JSON, khong giai thich.\n\n"
        f"Question: {question}\n"
        f"Gold answer: {gold_answer}\n"
        f"Model answer: {answer}\n"
        f"Context:\n{context_text if context_text else '(khong co context)'}"
    )
    payload = {
        "model": cfg.judge_model,
        "temperature": 0,
        "max_tokens": 120,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.openai_api_key}",
    }
    result = post_json("https://api.openai.com/v1/chat/completions", payload, headers, cfg.timeout_s)
    choices = result.get("choices") or []
    if not choices:
        return None, None
    text = str(((choices[0] or {}).get("message") or {}).get("content") or "").strip()
    obj = extract_first_json_object(text)
    if not obj:
        return None, None
    faithfulness = to_float_or_none(obj.get("faithfulness"))
    relevancy = to_float_or_none(obj.get("answer_relevancy"))
    if faithfulness is not None:
        faithfulness = max(0.0, min(1.0, faithfulness))
    if relevancy is not None:
        relevancy = max(0.0, min(1.0, relevancy))
    return faithfulness, relevancy


def compute_retrieval_metrics(
    gold_ids: Sequence[str], retrieved_ids: Sequence[str]
) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], Optional[float]]:
    gold = [g for g in gold_ids if g]
    retrieved = [r for r in retrieved_ids if r]
    if not gold:
        return None, None, None, None, None

    gold_set = set(gold)
    hits = [rid for rid in retrieved if rid in gold_set]
    hit_at_k = 1.0 if hits else 0.0
    recall = len(set(hits)) / len(gold_set) if gold_set else None
    precision = len(hits) / len(retrieved) if retrieved else 0.0
    context_recall = recall
    context_precision = precision
    mrr = 0.0
    for idx, rid in enumerate(retrieved, start=1):
        if rid in gold_set:
            mrr = 1.0 / idx
            break
    return hit_at_k, recall, mrr, context_precision, context_recall


def write_csv(path: Path, rows: Sequence[Dict[str, Any]], columns: Sequence[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(columns))
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def evaluate_run(
    questions: Sequence[Dict[str, Any]],
    threshold: float,
    num_rows: int,
    run_dir: Path,
    cfg: EvalConfig,
    dry_run: bool,
    progress_every: int,
    run_index: int,
    total_runs: int,
    progress_file: Path,
) -> Dict[str, Any]:
    run_dir.mkdir(parents=True, exist_ok=True)
    run_id = make_run_id(num_rows, threshold, cfg.k)

    predictions: List[Dict[str, Any]] = []
    total_questions = len(questions)
    started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    def update_progress(current_question: int, status: str) -> None:
        run_pct = (current_question / total_questions * 100.0) if total_questions else 100.0
        overall_pct = ((run_index - 1) + (current_question / total_questions if total_questions else 1.0)) / total_runs * 100.0
        payload = {
            "updated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "status": status,
            "overall": {
                "current_run": run_index,
                "total_runs": total_runs,
                "percent": round(overall_pct, 2),
            },
            "current_run": {
                "run_id": run_id,
                "num_rows": num_rows,
                "threshold": threshold,
                "k": cfg.k,
                "current_question": current_question,
                "total_questions": total_questions,
                "percent": round(run_pct, 2),
                "started_at_utc": started_at,
            },
        }
        progress_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    update_progress(0, "running")
    print(
        f"[RUN {run_index}/{total_runs}] {run_id} started | "
        f"queries=0/{total_questions} | run=0.0% | overall={((run_index-1)/total_runs*100):.1f}%"
    )

    for idx, row in enumerate(questions, start=1):
        question = str(row.get("question", "")).strip()
        gold_answer = str(row.get("gold_answer", "")).strip()
        gold_doc_ids = [str(x) for x in (row.get("gold_doc_ids") or [])]
        query_id = str(row.get("query_id") or f"Q{idx:04d}")

        if dry_run:
            predictions.append(
                {
                    "run_id": run_id,
                    "query_id": query_id,
                    "question": question,
                    "gold_answer": gold_answer,
                    "gold_doc_ids": json_dumps(gold_doc_ids),
                    "retrieved_doc_ids": "[]",
                    "retrieved_titles": "[]",
                    "retrieved_scores": "[]",
                    "hit_at_k": "",
                    "recall_at_k": "",
                    "mrr": "",
                    "context_precision": "",
                    "context_recall": "",
                    "faithfulness": "",
                    "answer_relevancy": "",
                    "retrieval_time_ms": "",
                    "gen_time_ms": "",
                    "latency_ms": "",
                    "threshold": threshold,
                    "num_rows": num_rows,
                    "k": cfg.k,
                    "error": "",
                }
            )
            if idx % max(progress_every, 1) == 0 or idx == total_questions:
                update_progress(idx, "running")
                run_pct = idx / total_questions * 100.0 if total_questions else 100.0
                overall_pct = ((run_index - 1) + (idx / total_questions if total_questions else 1.0)) / total_runs * 100.0
                print(
                    f"[RUN {run_index}/{total_runs}] {run_id} | "
                    f"queries={idx}/{total_questions} | run={run_pct:.1f}% | overall={overall_pct:.1f}%"
                )
            continue

        error_text = ""
        retrieved_docs: List[Dict[str, Any]] = []
        answer = ""
        faithfulness = None
        answer_relevancy = None
        retrieval_ms = None
        gen_ms = None
        latency_ms = None
        hit_at_k = None
        recall_at_k = None
        mrr = None
        context_precision = None
        context_recall = None

        t_start = time.perf_counter()
        try:
            t0 = time.perf_counter()
            retrieved_docs = retrieve_docs(question, threshold, cfg)
            retrieval_ms = (time.perf_counter() - t0) * 1000.0

            t1 = time.perf_counter()
            answer = generate_answer(question, retrieved_docs, cfg)
            gen_ms = (time.perf_counter() - t1) * 1000.0
            latency_ms = (time.perf_counter() - t_start) * 1000.0

            faithfulness, answer_relevancy = judge_answer(
                question=question,
                answer=answer,
                gold_answer=gold_answer,
                docs=retrieved_docs,
                cfg=cfg,
            )

            retrieved_doc_ids = [doc.get("doc_id") for doc in retrieved_docs if doc.get("doc_id")]
            (
                hit_at_k,
                recall_at_k,
                mrr,
                context_precision,
                context_recall,
            ) = compute_retrieval_metrics(gold_doc_ids, retrieved_doc_ids)

        except Exception as exc:  # noqa: BLE001
            error_text = str(exc)
            latency_ms = (time.perf_counter() - t_start) * 1000.0

        predictions.append(
            {
                "run_id": run_id,
                "query_id": query_id,
                "question": question,
                "gold_answer": gold_answer,
                "gold_doc_ids": json_dumps(gold_doc_ids),
                "retrieved_doc_ids": json_dumps(
                    [doc.get("doc_id") for doc in retrieved_docs if doc.get("doc_id")]
                ),
                "retrieved_titles": json_dumps([doc.get("title") for doc in retrieved_docs]),
                "retrieved_scores": json_dumps(
                    [round(float(doc.get("similarity", 0.0)), 6) for doc in retrieved_docs]
                ),
                "hit_at_k": hit_at_k if hit_at_k is not None else "",
                "recall_at_k": recall_at_k if recall_at_k is not None else "",
                "mrr": mrr if mrr is not None else "",
                "context_precision": context_precision if context_precision is not None else "",
                "context_recall": context_recall if context_recall is not None else "",
                "faithfulness": faithfulness if faithfulness is not None else "",
                "answer_relevancy": answer_relevancy if answer_relevancy is not None else "",
                "retrieval_time_ms": retrieval_ms if retrieval_ms is not None else "",
                "gen_time_ms": gen_ms if gen_ms is not None else "",
                "latency_ms": latency_ms if latency_ms is not None else "",
                "threshold": threshold,
                "num_rows": num_rows,
                "k": cfg.k,
                "error": error_text,
            }
        )

        if idx % max(progress_every, 1) == 0 or idx == total_questions:
            update_progress(idx, "running")
            run_pct = idx / total_questions * 100.0 if total_questions else 100.0
            overall_pct = ((run_index - 1) + (idx / total_questions if total_questions else 1.0)) / total_runs * 100.0
            print(
                f"[RUN {run_index}/{total_runs}] {run_id} | "
                f"queries={idx}/{total_questions} | run={run_pct:.1f}% | overall={overall_pct:.1f}%"
            )

    predictions_csv = run_dir / f"{run_id}_predictions.csv"
    predictions_jsonl = run_dir / f"{run_id}_predictions.jsonl"
    write_csv(predictions_csv, predictions, PREDICTION_COLUMNS)
    write_jsonl(predictions_jsonl, predictions)

    summary = {
        "run_id": run_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "num_rows": num_rows,
        "threshold": threshold,
        "k": cfg.k,
        "model": cfg.chat_model,
        "judge_model": cfg.judge_model,
        "num_queries": len(predictions),
        "latency_ms": safe_mean([to_float_or_none(r.get("latency_ms")) for r in predictions]),
        "retrieval_time_ms": safe_mean(
            [to_float_or_none(r.get("retrieval_time_ms")) for r in predictions]
        ),
        "gen_time_ms": safe_mean([to_float_or_none(r.get("gen_time_ms")) for r in predictions]),
        "context_precision": safe_mean(
            [to_float_or_none(r.get("context_precision")) for r in predictions]
        ),
        "context_recall": safe_mean(
            [to_float_or_none(r.get("context_recall")) for r in predictions]
        ),
        "faithfulness": safe_mean([to_float_or_none(r.get("faithfulness")) for r in predictions]),
        "answer_relevancy": safe_mean(
            [to_float_or_none(r.get("answer_relevancy")) for r in predictions]
        ),
        "hit_at_k": safe_mean([to_float_or_none(r.get("hit_at_k")) for r in predictions]),
        "recall_at_k": safe_mean([to_float_or_none(r.get("recall_at_k")) for r in predictions]),
        "mrr": safe_mean([to_float_or_none(r.get("mrr")) for r in predictions]),
    }

    summary_json = run_dir / f"{run_id}_summary.json"
    summary_csv = run_dir / f"{run_id}_summary.csv"
    summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(summary_csv, [summary], SUMMARY_COLUMNS)
    update_progress(total_questions, "completed")
    print(
        f"[RUN {run_index}/{total_runs}] {run_id} completed | "
        f"queries={total_questions}/{total_questions} | run=100.0% | "
        f"overall={(run_index/total_runs*100):.1f}%"
    )
    return summary


def parse_float_list(text: str) -> List[float]:
    parts = [p.strip() for p in text.split(",") if p.strip()]
    return [float(p) for p in parts]


def parse_int_list(text: str) -> List[int]:
    parts = [p.strip() for p in text.split(",") if p.strip()]
    return [int(p) for p in parts]


def read_env_or_default(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


def load_dotenv_files(paths: Sequence[Path], override: bool) -> None:
    for path in paths:
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            if not key:
                continue
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            if override or key not in os.environ:
                os.environ[key] = value


def build_config_from_env(args: argparse.Namespace) -> EvalConfig:
    load_dotenv_files([Path(p) for p in args.env_file], override=args.dotenv_override)

    openai_api_key = read_env_or_default("OPENAI_API_KEY")
    supabase_url = read_env_or_default("SUPABASE_URL")
    supabase_service_role_key = read_env_or_default("SUPABASE_SERVICE_ROLE_KEY")

    if not args.dry_run:
        missing = []
        if not openai_api_key:
            missing.append("OPENAI_API_KEY")
        if not supabase_url:
            missing.append("SUPABASE_URL")
        if not supabase_service_role_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        if missing:
            raise ValueError(
                "Missing required environment variables for real run: " + ", ".join(missing)
            )

    return EvalConfig(
        openai_api_key=openai_api_key or "",
        supabase_url=supabase_url or "",
        supabase_service_role_key=supabase_service_role_key or "",
        embed_model=args.embed_model,
        chat_model=args.chat_model,
        judge_model=args.judge_model,
        k=args.k,
        timeout_s=args.timeout_s,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run RAG evaluation matrix with naming convention and per-run folders."
    )
    parser.add_argument("--master", default="eval_questions_master_250.jsonl")
    parser.add_argument("--output-root", default="rag_eval_outputs")
    parser.add_argument("--thresholds", default="0.45,0.50,0.55,0.60")
    parser.add_argument("--row-sizes", default="100,150,200,250")
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--seed", type=int, default=20260422)
    parser.add_argument("--embed-model", default="text-embedding-3-small")
    parser.add_argument("--chat-model", default="gpt-4o-mini")
    parser.add_argument("--judge-model", default="gpt-4o-mini")
    parser.add_argument("--timeout-s", type=int, default=90)
    parser.add_argument(
        "--progress-every",
        type=int,
        default=5,
        help="Print and update progress every N questions.",
    )
    parser.add_argument(
        "--env-file",
        action="append",
        default=["backend/.env", ".env"],
        help="Dotenv files to auto-load before reading env vars. Can be repeated.",
    )
    parser.add_argument(
        "--dotenv-override",
        dest="dotenv_override",
        action="store_true",
        default=True,
        help="When true, values in --env-file override existing OS env vars.",
    )
    parser.add_argument(
        "--no-dotenv-override",
        dest="dotenv_override",
        action="store_false",
        help="Disable overriding OS env with dotenv values.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = build_config_from_env(args)
    master_path = Path(args.master)
    if not master_path.exists():
        raise FileNotFoundError(f"Master file not found: {master_path}")

    thresholds = parse_float_list(args.thresholds)
    row_sizes = parse_int_list(args.row_sizes)
    all_rows = load_jsonl(master_path)

    matrix_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    matrix_dir = Path(args.output_root) / f"matrix_{matrix_id}"
    matrix_dir.mkdir(parents=True, exist_ok=True)

    matrix_summaries: List[Dict[str, Any]] = []
    total_runs = len(row_sizes) * len(thresholds)
    run_counter = 0
    progress_file = matrix_dir / "progress.json"
    progress_file.write_text(
        json.dumps(
            {
                "updated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "status": "initialized",
                "overall": {"current_run": 0, "total_runs": total_runs, "percent": 0.0},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    for num_rows in row_sizes:
        subset = choose_subset_stratified(all_rows, num_rows, args.seed)
        for threshold in thresholds:
            run_counter += 1
            run_id = make_run_id(num_rows, threshold, cfg.k)
            run_dir = matrix_dir / run_id
            run_dir.mkdir(parents=True, exist_ok=True)

            subset_file = run_dir / f"{run_id}_eval_subset.jsonl"
            write_jsonl(subset_file, subset)

            print(f"[QUEUE] run {run_counter}/{total_runs}: {run_id} | rows={num_rows} | threshold={threshold:.2f}")
            summary = evaluate_run(
                questions=subset,
                threshold=threshold,
                num_rows=num_rows,
                run_dir=run_dir,
                cfg=cfg,
                dry_run=args.dry_run,
                progress_every=args.progress_every,
                run_index=run_counter,
                total_runs=total_runs,
                progress_file=progress_file,
            )
            matrix_summaries.append(summary)

    matrix_summary_csv = matrix_dir / "matrix_summary.csv"
    matrix_summary_json = matrix_dir / "matrix_summary.json"
    write_csv(matrix_summary_csv, matrix_summaries, SUMMARY_COLUMNS)
    matrix_summary_json.write_text(
        json.dumps(matrix_summaries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    info = {
        "matrix_id": f"matrix_{matrix_id}",
        "master_file": str(master_path),
        "thresholds": thresholds,
        "row_sizes": row_sizes,
        "k": cfg.k,
        "seed": args.seed,
        "embed_model": cfg.embed_model,
        "chat_model": cfg.chat_model,
        "judge_model": cfg.judge_model,
        "dry_run": args.dry_run,
        "created_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    (matrix_dir / "run_info.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    progress_file.write_text(
        json.dumps(
            {
                "updated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "status": "completed",
                "overall": {"current_run": total_runs, "total_runs": total_runs, "percent": 100.0},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[DONE] Output folder: {matrix_dir}")


if __name__ == "__main__":
    main()
