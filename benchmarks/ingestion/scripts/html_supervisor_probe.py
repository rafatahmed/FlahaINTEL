"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: HTML Candidate Supervisor Probe
Introduction:
Runs a closed candidate adapter command without URLs, secrets, or shell expansion.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-16
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = {
    "stdlib": (Path(sys.executable), ROOT / "scripts/html_stdlib_adapter.py"),
    "lxml": (ROOT.parents[1] / ".benchmark-envs/html-lxml-6.1.1-py314/Scripts/python.exe", ROOT / "scripts/html_lxml_adapter.py"),
    "selectolax": (ROOT.parents[1] / ".benchmark-envs/html-selectolax-0.4.10-py314/Scripts/python.exe", ROOT / "scripts/html_selectolax_adapter.py"),
}


def probe(candidate: str, artifact_key: str, timeout: float = 10.0) -> dict[str, object]:
    python, adapter = CANDIDATES[candidate]
    environment = {"PATH": str(python.parent), "SYSTEMROOT": os.environ.get("SYSTEMROOT", r"C:\Windows"), "TEMP": os.environ.get("TEMP", ""), "PYTHONIOENCODING": "utf-8"}
    completed = subprocess.run([str(python), "-I", str(adapter), "--corpus-root", str(ROOT / "corpus"), "--artifact-key", artifact_key], capture_output=True, text=True, encoding="utf-8", timeout=timeout, env=environment, shell=False, check=False)
    return {"candidate": candidate, "returnCode": completed.returncode, "stdout": json.loads(completed.stdout) if completed.returncode == 0 else None, "stderr": completed.stderr[-2000:], "databaseUrlCopied": "DATABASE_URL" in environment, "urlArgumentAccepted": False, "shellUsed": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", choices=sorted(CANDIDATES))
    parser.add_argument("artifact_key")
    args = parser.parse_args()
    print(json.dumps(probe(args.candidate, args.artifact_key), ensure_ascii=False, sort_keys=True, separators=(",", ":")))
