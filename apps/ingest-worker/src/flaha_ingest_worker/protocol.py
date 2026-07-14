"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Reference Worker Protocol Utilities
Introduction:
Provides bounded request parsing and deterministic JSONL message emission.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

import json
import sys

MAXIMUM_INPUT_BYTES = 1024 * 1024

class RequestError(Exception):
    pass

def read_request(stream=None):
    stream = stream or sys.stdin.buffer
    line = stream.readline(MAXIMUM_INPUT_BYTES + 2)
    if not line:
        raise RequestError("missing request")
    if len(line) > MAXIMUM_INPUT_BYTES or not line.endswith(b"\n"):
        raise RequestError("request line exceeded limit or was incomplete")
    try:
        value = json.loads(line)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RequestError("malformed request JSON") from error
    required = {"contractVersion", "correlationId", "jobId", "attemptId", "messageType", "operation", "provider", "policySnapshot", "payload"}
    if not isinstance(value, dict) or not required.issubset(value) or value["messageType"] != "WORKER_REQUEST":
        raise RequestError("invalid request envelope")
    if value["contractVersion"] != "1.0.0":
        raise RequestError("unsupported contract version")
    if "DATABASE_URL" in value:
        raise RequestError("database credentials are forbidden")
    return value

def emit(value, stream=None):
    stream = stream or sys.stdout
    stream.write(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    stream.flush()
