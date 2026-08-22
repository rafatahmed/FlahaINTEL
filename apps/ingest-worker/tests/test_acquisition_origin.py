"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Acquisition origin helper tests
Introduction: Default HTTPS port must match robots.txt and stripped-port redirects.

Created by: Rafat Al Khashan
Created date: 2026-08-21
Last modified: 2026-08-22
"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))
from acquisition_origin import public_url, same_origin


class AcquisitionOriginTests(unittest.TestCase):
    def test_https_default_port_matches_robots_and_stripped_redirect(self):
        origin = public_url("https", "example.com", 443, "")
        self.assertEqual(origin, "https://example.com")
        self.assertTrue(same_origin("https://example.com/robots.txt", "https://example.com:443"))
        self.assertTrue(same_origin("https://example.com/", "https://example.com:443"))
        self.assertTrue(same_origin("https://example.com:443/page", "https://example.com"))

    def test_rejects_host_and_scheme_escape(self):
        origin = "https://example.com:443"
        self.assertFalse(same_origin("https://www.example.com/", origin))
        self.assertFalse(same_origin("http://example.com/", origin))
        self.assertFalse(same_origin("https://evil.test/", origin))

    def test_origin_helper_imports_under_isolated_python(self):
        code = (
            "import sys\n"
            f"sys.path.insert(0, {str(SRC)!r})\n"
            "from acquisition_origin import public_url\n"
            "print(public_url('https', 'h', 443, '/p'))\n"
        )
        proc = subprocess.run(
            [sys.executable, "-I", "-c", code],
            cwd=tempfile.gettempdir(),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout.strip(), "https://h/p")

    def test_scrapy_worker_source_adds_script_dir_before_origin_import(self):
        source = (SRC / "acquisition_scrapy_worker.py").read_text(encoding="utf-8")
        insert_at = source.index("sys.path.insert")
        import_at = source.index("from acquisition_origin import")
        self.assertLess(insert_at, import_at)


if __name__ == "__main__":
    unittest.main()
