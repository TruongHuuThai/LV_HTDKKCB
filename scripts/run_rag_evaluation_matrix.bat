@echo off
setlocal

cd /d "%~dp0\.."

python scripts\run_rag_evaluation_matrix.py ^
  --master eval_questions_master_250.jsonl ^
  --output-root rag_eval_outputs ^
  --thresholds 0.45,0.50,0.55,0.60 ^
  --row-sizes 100,150,200,250 ^
  --k 5

endlocal
