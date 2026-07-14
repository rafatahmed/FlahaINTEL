"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Deterministic Reference Provider
Introduction:
Emits controlled protocol outcomes used to verify the worker boundary.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

import os
import subprocess
import sys
import threading
import time

from protocol import emit

def context(request, message_type, sequence):
    return {"contractVersion": request["contractVersion"], "correlationId": request["correlationId"], "causationId": request["jobId"], "jobId": request["jobId"], "attemptId": request["attemptId"], "messageType": message_type, "sequence": sequence}

def progress(request, sequence, status="IN_PROGRESS"):
    return {**context(request, "WORKER_PROGRESS", sequence), "occurredAt": request["sentAt"], "stage": "CONVERT", "status": status, "completedUnits": sequence + 1, "totalUnits": 2, "unit": "STEPS", "metrics": {"wallTimeMs": sequence, "peakMemoryBytes": 0, "bytesRead": 0, "bytesWritten": 0}}

def descriptor(request):
    return {**request["provider"], "contractVersions": ["1.0.0"], "operations": [request["operation"]], "inputMediaTypes": ["application/pdf"], "outputMediaTypes": ["application/json"], "capabilities": ["OFFLINE", "CANCELLATION"], "offlineCapable": True, "deterministicClaim": "DETERMINISTIC", "requiresNetwork": False, "binaryDigest": None, "modelDigests": [], "generatedAt": request["sentAt"]}

def success_result(request, sequence, outside=False, operation=None):
    prefix = request["policySnapshot"]["stagingPrefix"]
    key = "staging/wrong/attempt/result.json" if outside else prefix + "/result.json"
    artifact = {"artifactId": "00000000-0000-4000-8000-000000000501", "artifactClass": "STAGING", "role": "STRUCTURED", "key": key, "mediaType": "application/json", "byteLength": 0, "checksumAlgorithm": "SHA256", "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "immutable": False, "createdAt": request["sentAt"]}
    result = {"operation": operation or request["operation"], "inputArtifactId": request["payload"]["inputArtifact"]["artifactId"], "outputs": [artifact], "pageCount": 1, "convertedPageCount": 1, "detectedLanguages": [], "textDirection": "UNKNOWN", "ocrUsed": False, "tableCount": 0, "imageCount": 0, "providerNativeOutput": artifact, "markdownOutput": None, "pageManifestOutput": artifact, "warnings": [], "metrics": {"wallTimeMs": 0, "peakMemoryBytes": 0, "bytesRead": 0, "bytesWritten": 0}, "derivation": {"inputChecksums": [request["payload"]["inputArtifact"]["checksum"]], "provider": request["provider"], "optionsDigest": "0" * 64, "modelDigests": []}}
    return {**context(request, "WORKER_RESULT", sequence), "startedAt": request["sentAt"], "finishedAt": request["sentAt"], "outcome": "SUCCEEDED", "providerDescriptor": descriptor(request), "warnings": [], "metrics": {"wallTimeMs": 0, "peakMemoryBytes": 0, "bytesRead": 0, "bytesWritten": 0}, "result": result, "error": None}

def failure_result(request, sequence, cancelled=False):
    category = "CANCELLED" if cancelled else "PROVIDER_FAILURE"
    return {**context(request, "WORKER_RESULT", sequence), "startedAt": request["sentAt"], "finishedAt": request["sentAt"], "outcome": "CANCELLED" if cancelled else "FAILED", "providerDescriptor": descriptor(request), "warnings": [], "metrics": {"wallTimeMs": 0, "peakMemoryBytes": 0, "bytesRead": 0, "bytesWritten": 0}, "result": None, "error": {"code": "CANCELLED_BY_SUPERVISOR" if cancelled else "REFERENCE_FAILURE", "category": category, "retryable": False, "message": "Reference cancellation." if cancelled else "Reference failure."}}

def run(request):
    options = request["payload"].get("providerOptions", {})
    mode = options.get("mode", "success")
    delay = int(options.get("delayMs", 250)) / 1000
    if mode == "malformed": print("{malformed", flush=True); return 0
    if mode == "oversized_output": print("x" * (2 * 1024 * 1024), flush=True); return 0
    if mode == "exit_before_result": return 0
    if mode == "stderr": print("reference diagnostic", file=sys.stderr, flush=True)
    if mode == "stderr_overflow": print("d" * 10000, file=sys.stderr, flush=True)
    if mode == "environment":
        print(f"DATABASE_URL_PRESENT={int('DATABASE_URL' in os.environ)}", file=sys.stderr, flush=True)
        print(f"SECRET_PRESENT={int('FLAHA_UNRELATED_SECRET' in os.environ)}", file=sys.stderr, flush=True)
        print(f"TEST_MARKER={os.environ.get('FLAHA_WORKER_TEST_MARKER', '')}", file=sys.stderr, flush=True)
    if mode == "spawn_child":
        child = subprocess.Popen([sys.executable, "-I", "-c", "import time; time.sleep(60)"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"CHILD_PID={child.pid}", file=sys.stderr, flush=True)
    if mode in {"delayed", "forced_cancel", "spawn_child"}:
        cancelled = threading.Event()
        threading.Thread(target=lambda: (sys.stdin.buffer.read(), cancelled.set()), daemon=True).start()
        end = time.monotonic() + delay
        while time.monotonic() < end:
            if cancelled.is_set() and mode != "forced_cancel" and mode != "spawn_child":
                emit(progress(request, 0, "CANCELLATION_ACKNOWLEDGED")); emit(failure_result(request, 1, True)); return 0
            time.sleep(0.01)
    if mode != "zero_progress": emit(progress(request, 0))
    terminal = failure_result(request, 1) if mode == "failure" else success_result(request, 1, mode == "outside_staging", "CONTENT_EXTRACTION" if mode == "operation_mismatch" else None)
    if mode == "wrong_contract": terminal["contractVersion"] = "2.0.0"
    if mode == "wrong_correlation": terminal["correlationId"] = "00000000-0000-4000-8000-000000000999"
    if mode == "wrong_job": terminal["jobId"] = "00000000-0000-4000-8000-000000000999"
    if mode == "wrong_attempt": terminal["attemptId"] = "00000000-0000-4000-8000-000000000999"
    if mode == "unknown_message": terminal["messageType"] = "UNKNOWN"
    if mode in {"sequence_regression", "duplicate_progress"}: emit(progress(request, 0))
    emit(terminal)
    if mode == "duplicate_terminal": emit(terminal)
    if mode == "progress_after_terminal": emit(progress(request, 2))
    return 0
