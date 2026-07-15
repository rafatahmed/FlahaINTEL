"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: DuckDB Supervisor Isolation Probe
Introduction:
Reports benchmark-only DuckDB runtime and sanitized-environment evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,os,site,sys
import duckdb
tokens=("DATABASE_URL","SECRET","TOKEN","PASSWORD","API_KEY","AWS_","AZURE_","GOOGLE_","PROXY")
print(json.dumps({"duckdbVersion":duckdb.__version__,"databaseUrlPresent":"DATABASE_URL" in os.environ,"sensitiveEnvironmentPresent":any(any(t in k.upper() for t in tokens) for k in os.environ),"userSiteEnabled":site.ENABLE_USER_SITE,"userSiteInPath":site.getusersitepackages() in sys.path}),file=sys.stderr,flush=True)
