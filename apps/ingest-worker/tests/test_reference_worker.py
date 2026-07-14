"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Reference Worker Protocol Tests
Introduction:
Verifies deterministic output, cancellation, isolation, and process cleanup.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

import copy
import io
import json
import os
import pathlib
import subprocess
import sys
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[3]
ENTRY = ROOT / "apps" / "ingest-worker" / "src" / "flaha_ingest_worker" / "__main__.py"
FIXTURE = ROOT / "packages" / "ingestion-contracts" / "fixtures" / "valid" / "protocol" / "worker-request-document.json"


class ReferenceWorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.request = json.loads(FIXTURE.read_text(encoding="utf-8"))

    def run_worker(self, request=None, raw=None):
        data = raw if raw is not None else json.dumps(request or self.request, separators=(",", ":")) + "\n"
        return subprocess.run([sys.executable, "-I", "-u", str(ENTRY)], input=data, text=True,
                              capture_output=True, cwd=ENTRY.parents[2], timeout=5, check=False)

    def mode(self, name, **options):
        request = copy.deepcopy(self.request)
        request["payload"]["providerOptions"] = {"mode": name, **options}
        return request

    def messages(self, process):
        return [json.loads(line) for line in process.stdout.splitlines()]

    def test_valid_request_has_progress_and_one_terminal(self):
        process = self.run_worker()
        messages = self.messages(process)
        self.assertEqual(process.returncode, 0)
        self.assertEqual([m["messageType"] for m in messages], ["WORKER_PROGRESS", "WORKER_RESULT"])
        self.assertEqual(sum(m["messageType"] == "WORKER_RESULT" for m in messages), 1)
        self.assertEqual(process.stderr, "")

    def test_malformed_and_oversized_requests_are_rejected(self):
        malformed = self.run_worker(raw="{bad\n")
        oversized = self.run_worker(raw="x" * (1024 * 1024 + 1) + "\n")
        self.assertEqual(malformed.returncode, 2)
        self.assertEqual(oversized.returncode, 2)
        self.assertEqual(malformed.stdout, "")
        self.assertEqual(oversized.stdout, "")

    def test_success_and_failure_are_deterministic(self):
        for mode in ("success", "failure"):
            first = self.run_worker(self.mode(mode))
            second = self.run_worker(self.mode(mode))
            self.assertEqual(first.stdout, second.stdout)
            self.assertEqual(first.stderr, second.stderr)
        self.assertEqual(self.messages(self.run_worker(self.mode("failure")))[-1]["outcome"], "FAILED")

    def test_stderr_is_separate_from_protocol_stdout(self):
        process = self.run_worker(self.mode("stderr"))
        self.assertIn("reference diagnostic", process.stderr)
        for line in process.stdout.splitlines():
            self.assertIsInstance(json.loads(line), dict)

    def test_zero_progress_still_has_exactly_one_terminal(self):
        messages = self.messages(self.run_worker(self.mode("zero_progress")))
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["messageType"], "WORKER_RESULT")

    def test_stdin_eof_requests_graceful_cancellation(self):
        process = subprocess.Popen([sys.executable, "-I", "-u", str(ENTRY)], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=ENTRY.parents[2])
        process.stdin.write(json.dumps(self.mode("delayed", delayMs=5000)) + "\n")
        process.stdin.flush()
        time.sleep(0.1)
        process.stdin.close()
        process.wait(timeout=3)
        messages = [json.loads(line) for line in process.stdout.read().splitlines()]
        process.stdout.close()
        process.stderr.close()
        self.assertEqual(messages[-1]["outcome"], "CANCELLED")
        self.assertEqual(process.returncode, 0)

    @unittest.skipUnless(os.name == "nt", "Windows process-tree behavior")
    def test_spawned_child_is_killable_with_parent_tree(self):
        process = subprocess.Popen([sys.executable, "-I", "-u", str(ENTRY)], stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=ENTRY.parents[2])
        process.stdin.write(json.dumps(self.mode("spawn_child", delayMs=60000)) + "\n")
        process.stdin.flush()
        child_line = process.stderr.readline().strip()
        child_pid = int(child_line.split("=", 1)[1])
        killed = subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, check=False)
        self.assertEqual(killed.returncode, 0, killed.stderr.decode(errors="replace"))
        process.wait(timeout=5)
        check = subprocess.run(["tasklist", "/FI", f"PID eq {child_pid}", "/NH"], capture_output=True, text=True)
        self.assertNotIn(str(child_pid), check.stdout)
        process.stdin.close()
        process.stdout.close()
        process.stderr.close()


if __name__ == "__main__":
    unittest.main()
