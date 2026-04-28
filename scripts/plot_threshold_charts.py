import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import matplotlib.pyplot as plt


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_gold_ids(text: str) -> List[str]:
    if not text:
        return []
    try:
        payload = json.loads(text)
        if isinstance(payload, list):
            return [str(x) for x in payload if str(x).strip()]
    except json.JSONDecodeError:
        pass
    return []


def load_matrix_summary(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def weighted_avg_by_threshold(rows: Sequence[Dict[str, Any]], metric: str) -> Dict[float, float]:
    weighted_sum: Dict[float, float] = defaultdict(float)
    total_weight: Dict[float, float] = defaultdict(float)
    for row in rows:
        threshold = to_float(row.get("threshold"))
        value = to_float(row.get(metric))
        num_queries = to_float(row.get("num_queries")) or 0.0
        if threshold is None or value is None or num_queries <= 0:
            continue
        weighted_sum[threshold] += value * num_queries
        total_weight[threshold] += num_queries
    result: Dict[float, float] = {}
    for threshold in sorted(total_weight.keys()):
        weight = total_weight[threshold]
        if weight > 0:
            result[threshold] = weighted_sum[threshold] / weight
    return result


def find_prediction_files(matrix_dir: Path) -> List[Path]:
    return sorted(matrix_dir.glob("n*_t*p*_k*/*_predictions.csv"))


def collect_frr_by_threshold(prediction_files: Sequence[Path]) -> Dict[float, List[float]]:
    by_threshold: Dict[float, List[float]] = defaultdict(list)
    for file_path in prediction_files:
        with file_path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                threshold = to_float(row.get("threshold"))
                hit_at_k = to_float(row.get("hit_at_k"))
                gold_ids = parse_gold_ids(str(row.get("gold_doc_ids") or ""))
                if threshold is None or hit_at_k is None:
                    continue
                # Exclude out-of-scope rows (no gold doc), FRR is only for retrieval-needed rows.
                if len(gold_ids) == 0:
                    continue
                by_threshold[threshold].append(1.0 - hit_at_k)
    return by_threshold


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def plot_grouped_metrics(
    thresholds: Sequence[float],
    metric_values: Dict[str, Dict[float, float]],
    title: str,
    output_path: Path,
    y_label: str = "Score",
) -> None:
    plt.figure(figsize=(10, 5.6))
    x = list(range(len(thresholds)))

    width = 0.18 if len(metric_values) >= 4 else 0.24
    metric_items = list(metric_values.items())
    offset_start = -(len(metric_items) - 1) / 2.0

    for i, (metric_name, values) in enumerate(metric_items):
        bar_x = [xi + (offset_start + i) * width for xi in x]
        bar_y = [values.get(t, 0.0) for t in thresholds]
        plt.bar(bar_x, bar_y, width=width, label=metric_name)

    plt.xticks(x, [f"{t:.2f}" for t in thresholds])
    plt.xlabel("Threshold")
    plt.ylabel(y_label)
    plt.ylim(0, 1.05)
    plt.title(title)
    plt.grid(axis="y", alpha=0.25)
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=180)
    plt.close()


def plot_frr_distribution(
    thresholds: Sequence[float],
    frr_values: Dict[float, List[float]],
    output_path: Path,
) -> None:
    labels = [f"{t:.2f}" for t in thresholds]
    miss_counts: List[int] = []
    hit_counts: List[int] = []
    miss_rates: List[float] = []

    for t in thresholds:
        values = frr_values.get(t, [])
        miss = sum(1 for v in values if v >= 0.5)  # FRR=1 means retrieval miss
        hit = sum(1 for v in values if v < 0.5)    # FRR=0 means retrieval hit
        total = miss + hit
        miss_rate = (miss / total) if total > 0 else 0.0
        miss_counts.append(miss)
        hit_counts.append(hit)
        miss_rates.append(miss_rate)

    x = list(range(len(thresholds)))
    fig, ax1 = plt.subplots(figsize=(10, 5.6))

    ax1.bar(x, hit_counts, label="Hit (FRR=0)", color="#2ca02c")
    ax1.bar(x, miss_counts, bottom=hit_counts, label="Miss (FRR=1)", color="#d62728")
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels)
    ax1.set_xlabel("Threshold")
    ax1.set_ylim(0, 700)
    ax1.set_ylabel("Số lượng mẫu")
    ax1.set_title("Phân bố FRR theo Threshold")
    ax1.grid(axis="y", alpha=0.25)

    ax2 = ax1.twinx()
    ax2.plot(x, miss_rates, color="#1f77b4", marker="o", linewidth=2, label="FRR rate")
    ax2.set_ylabel("Tỷ lệ FRR")
    ax2.set_ylim(0, 1.05)

    handles1, labels1 = ax1.get_legend_handles_labels()
    handles2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(handles1 + handles2, labels1 + labels2, loc="upper left")

    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Plot threshold charts from evaluation matrix output.")
    parser.add_argument("--matrix-dir", required=True, help="Path to matrix_YYYYMMDD_HHMMSS folder")
    parser.add_argument("--out-dir", default="", help="Output dir for chart images (default: <matrix-dir>/charts)")
    args = parser.parse_args()

    matrix_dir = Path(args.matrix_dir)
    if not matrix_dir.exists():
        raise FileNotFoundError(f"Matrix directory not found: {matrix_dir}")

    summary_csv = matrix_dir / "matrix_summary.csv"
    if not summary_csv.exists():
        raise FileNotFoundError(f"Missing matrix_summary.csv in: {matrix_dir}")

    out_dir = Path(args.out_dir) if args.out_dir else matrix_dir / "charts"
    ensure_dir(out_dir)

    rows = load_matrix_summary(summary_csv)
    thresholds = sorted({to_float(r.get("threshold")) for r in rows if to_float(r.get("threshold")) is not None})
    thresholds = [t for t in thresholds if t is not None]
    if not thresholds:
        raise ValueError("No threshold values found in matrix_summary.csv")

    retrieval_metrics = {
        "Hit@K": weighted_avg_by_threshold(rows, "hit_at_k"),
        "Recall@K": weighted_avg_by_threshold(rows, "recall_at_k"),
        "MRR": weighted_avg_by_threshold(rows, "mrr"),
    }
    plot_grouped_metrics(
        thresholds=thresholds,
        metric_values=retrieval_metrics,
        title="Trung bình Metric Retrieval theo Threshold",
        output_path=out_dir / "retrieval_metrics_by_threshold.png",
    )

    quality_metrics = {
        "Faithfulness": weighted_avg_by_threshold(rows, "faithfulness"),
        "Answer Relevancy": weighted_avg_by_threshold(rows, "answer_relevancy"),
    }
    plot_grouped_metrics(
        thresholds=thresholds,
        metric_values=quality_metrics,
        title="Trung bình Metric chất lượng theo Threshold",
        output_path=out_dir / "quality_metrics_by_threshold.png",
    )

    prediction_files = find_prediction_files(matrix_dir)
    frr_values = collect_frr_by_threshold(prediction_files)
    plot_frr_distribution(
        thresholds=thresholds,
        frr_values=frr_values,
        output_path=out_dir / "frr_distribution_by_threshold.png",
    )

    print(f"Saved charts to: {out_dir}")
    print(f"- {out_dir / 'retrieval_metrics_by_threshold.png'}")
    print(f"- {out_dir / 'frr_distribution_by_threshold.png'}")
    print(f"- {out_dir / 'quality_metrics_by_threshold.png'}")


if __name__ == "__main__":
    main()
