"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Isolated Environment Tests
Introduction:
Verifies exact distributions, contained imports, clean environment, and no listener.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,os,pathlib,socket,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[3]; PY=ROOT/".benchmark-envs"/"pandas-2.3.3-py314"/"Scripts"/"python.exe"

class IsolationTests(unittest.TestCase):
 def run_isolated(self,code):
  env={k:v for k,v in os.environ.items() if k in {"SYSTEMROOT","WINDIR","TEMP","TMP"}}; env["DATABASE_URL"]="must-not-be-used"; env.pop("DATABASE_URL")
  return subprocess.run([PY,"-I","-c",code],env=env,text=True,capture_output=True,check=True)
 def test_versions_paths_user_site_and_secrets(self):
  code="import importlib.metadata as m,json,pandas,numpy,site,sys,os; print(json.dumps({'v':{n:m.version(n) for n in ['pandas','numpy','python-dateutil','pytz','tzdata','six']},'paths':[pandas.__file__,numpy.__file__],'sys':sys.path,'user':site.getusersitepackages(),'enabled':site.ENABLE_USER_SITE,'db':'DATABASE_URL' in os.environ}))"
  value=json.loads(self.run_isolated(code).stdout); self.assertEqual(value["v"],{"pandas":"2.3.3","numpy":"2.3.5","python-dateutil":"2.9.0.post0","pytz":"2026.2","tzdata":"2026.3","six":"1.17.0"}); self.assertTrue(all(".benchmark-envs" in p for p in value["paths"])); self.assertNotIn(value["user"],value["sys"]); self.assertFalse(value["enabled"]); self.assertFalse(value["db"])
 def test_no_unapproved_runtime_distribution(self):
  output=self.run_isolated("import importlib.metadata as m,json; print(json.dumps(sorted(d.metadata['Name'].lower() for d in m.distributions())))").stdout
  values=set(json.loads(output)); self.assertEqual(values,{"pip","pandas","numpy","python-dateutil","pytz","tzdata","six"})
 def test_no_listener(self):
  before=[]
  for port in (3003,5174):
   with socket.socket() as s:
    try:s.bind(("127.0.0.1",port)); before.append(True)
    except OSError:before.append(False)
  self.run_isolated("import pandas,numpy")
  after=[]
  for port in (3003,5174):
   with socket.socket() as s:
    try:s.bind(("127.0.0.1",port)); after.append(True)
    except OSError:after.append(False)
  self.assertEqual(before,after)

if __name__=="__main__": unittest.main()
