"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Deterministic Large Dataset Generator
Introduction:
Generates bounded ignored bilingual CSV inputs with stable content and hashes.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import csv, hashlib
from pathlib import Path

HEADER = ["id","language","crop","integer_value","decimal_value","float_value","active","nullable","timestamp","description"]

def generate(root: Path, rows: int) -> dict[str, object]:
    if rows not in {10_000, 100_000, 500_000}: raise ValueError("unsupported governed scale")
    root = root.resolve(); root.mkdir(parents=True, exist_ok=True)
    path = root / f"dataset-{rows}.csv"
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer=csv.writer(stream, lineterminator="\n"); writer.writerow(HEADER)
        for i in range(rows):
            ar=i%2==1
            writer.writerow([i,"ar" if ar else "en","قمح" if ar else "wheat",i%1000,f"{i%10000}.{i%100:02d}",f"{(i%997)/10:.1f}","true" if i%3 else "false","" if i%7==0 else f"v{i%17}",f"2026-07-{i%28+1:02d}T{i%24:02d}:00:00Z",("نص زراعي " if ar else "agricultural text ")+str(i%101)])
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    return {"relativePath":path.name,"rows":rows,"bytes":path.stat().st_size,"sha256":digest}

if __name__ == "__main__":
    base=Path(__file__).resolve().parents[1]/"generated-corpus"
    for count in (10_000,100_000): print(generate(base,count))
