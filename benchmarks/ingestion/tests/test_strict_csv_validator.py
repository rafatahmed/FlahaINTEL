"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Strict CSV Validator Tests
Introduction:
Verifies deterministic acceptance and fail-closed CSV policy classifications.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import pathlib,sys,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/"scripts"))
from strict_csv_validator import CsvLimits,CsvValidationError,validate_csv

class StrictCsvTests(unittest.TestCase):
 def check(self,data:bytes,code:str,limits=CsvLimits()):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"x.csv"; p.write_bytes(data)
   with self.assertRaises(CsvValidationError) as caught: validate_csv(p,limits)
   self.assertEqual(caught.exception.code,code)
 def test_valid_and_arabic(self):
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"x.csv"; p.write_text("id,name\n1,قمح\n",encoding="utf-8"); self.assertEqual(validate_csv(p),{"columns":2,"dataRows":1})
 def test_inconsistent(self): self.check(b"a,b\n1\n","CSV_INCONSISTENT_FIELDS")
 def test_unterminated_quote(self): self.check(b'a,b\n1,"x\n',"CSV_UNTERMINATED_QUOTE")
 def test_malformed_quote(self): self.check(b'a,b\n1,x"y\n',"CSV_MALFORMED_QUOTE")
 def test_nul(self): self.check(b"a,b\n1,\0\n","CSV_NUL_BYTE")
 def test_invalid_utf8(self): self.check(b"a,b\n1,\xff\n","CSV_INVALID_ENCODING")
 def test_row_too_long(self): self.check(b"a\n12345\n","CSV_ROW_TOO_LONG",CsvLimits(max_row_bytes=4))
 def test_field_too_long(self): self.check(b"a\n12345\n","CSV_FIELD_TOO_LONG",CsvLimits(max_field_chars=4))
 def test_columns(self): self.check(b"a,b\n1,2\n","CSV_TOO_MANY_COLUMNS",CsvLimits(max_columns=1))
 def test_delimiter_ambiguity(self): self.check(b"a;b\n1;2\n","CSV_DELIMITER_AMBIGUITY")

if __name__=="__main__": unittest.main()
