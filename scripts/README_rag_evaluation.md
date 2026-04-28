# RAG Evaluation Matrix Runner

## Purpose
Run evaluation in a `4 x 4` matrix:
- `num_rows`: `100, 150, 200, 250`
- `threshold`: `0.45, 0.50, 0.55, 0.60`

Total: `16` runs.

Metrics summarized per run:
- `Faithfulness`
- `Answer Relevancy`
- `Context Precision`
- `Context Recall`
- `Hit@K`
- `Recall@K`
- `MRR`
- `Latency`

## Required environment variables
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Script will auto-load dotenv files by default in this order:
- `backend/.env`
- `.env`

## Run from CMD / PowerShell
```bat
cd /d "d:\9. Luận văn\0. code\umc"
python scripts\run_rag_evaluation_matrix.py
```

Or run batch file:
```bat
scripts\run_rag_evaluation_matrix.bat
```

## Dry-run (no API calls)
Use this to validate folder and file naming only:
```bat
python scripts\run_rag_evaluation_matrix.py --dry-run
```

## Progress tracking
Script now shows progress in terminal:
- Overall matrix progress: `run x/16`
- Current run progress: `queries y/n`, `% run`, `% overall`

It also writes live progress to:
- `rag_eval_outputs/matrix_.../progress.json`

Control update frequency:
```bat
python scripts\run_rag_evaluation_matrix.py --progress-every 5
```

## Naming convention
Each run id:
- `n{num_rows}_t{threshold}_k{k}`
- Example: `n150_t0p55_k5`

Matrix output folder:
- `rag_eval_outputs/matrix_YYYYMMDD_HHMMSS/`

Per run folder:
- `rag_eval_outputs/matrix_.../n150_t0p55_k5/`

Files in each run folder:
- `{run_id}_eval_subset.jsonl`
- `{run_id}_predictions.csv`
- `{run_id}_predictions.jsonl`
- `{run_id}_summary.csv`
- `{run_id}_summary.json`

Matrix-level files:
- `matrix_summary.csv`
- `matrix_summary.json`
- `run_info.json`
