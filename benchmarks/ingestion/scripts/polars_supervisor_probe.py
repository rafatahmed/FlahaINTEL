"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Polars Supervisor Isolation Probe
Introduction:
Reports benchmark-only Polars import and sanitized-environment evidence to stderr.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
import json,os,platform,site,sys
import polars
sensitive=any(any(token in name.upper() for token in ("DATABASE_URL","SECRET","TOKEN","PASSWORD","API_KEY")) for name in os.environ)
print(json.dumps({"polarsVersion":polars.__version__,"machine":platform.machine(),"databaseUrlPresent":"DATABASE_URL" in os.environ,"sensitiveEnvironmentPresent":sensitive,"userSiteEnabled":site.ENABLE_USER_SITE,"userSiteInPath":site.getusersitepackages() in sys.path}),file=sys.stderr,flush=True)
