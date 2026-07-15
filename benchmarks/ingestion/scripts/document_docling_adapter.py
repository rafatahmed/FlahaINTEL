"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed Docling Slim Adapter
Introduction:
Runs local non-OCR PDF conversion with immutable models and disabled extensions.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MODELS = ROOT / ".benchmark-models" / "document-docling-slim-2.111.0"
_CONVERTER = None


def _converter():
    global _CONVERTER
    if _CONVERTER is not None:
        return _CONVERTER
    from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption
    options = PdfPipelineOptions(artifacts_path=MODELS, do_ocr=False, do_table_structure=True,
        enable_remote_services=False, allow_external_plugins=False,
        accelerator_options=AcceleratorOptions(device=AcceleratorDevice.CPU, num_threads=2))
    _CONVERTER=DocumentConverter(format_options={InputFormat.PDF:PdfFormatOption(pipeline_options=options)})
    return _CONVERTER


def convert(path: Path) -> dict[str, object]:
    if path.suffix.lower() != ".pdf" or not path.resolve().is_relative_to((ROOT / "benchmarks/ingestion/corpus").resolve()):
        raise ValueError("Only governed local PDF fixtures are accepted")
    os.environ.update({"HF_HUB_OFFLINE":"1","TRANSFORMERS_OFFLINE":"1","HF_DATASETS_OFFLINE":"1","DO_NOT_TRACK":"1","NO_PROXY":"*","no_proxy":"*"})
    started=time.perf_counter_ns(); result=_converter().convert(path)
    document=result.document
    return {"candidate":"docling-slim","version":"2.111.0","classification":"SUCCESS","text":document.export_to_text(),
        "markdown":document.export_to_markdown(),"pages":len(document.pages),"elapsedNanoseconds":time.perf_counter_ns()-started,
        "ocrEnabled":False,"remoteServicesEnabled":False,"externalPluginsEnabled":False}


if __name__ == "__main__":
    print(json.dumps(convert(Path(sys.argv[1])), ensure_ascii=False, sort_keys=True))
