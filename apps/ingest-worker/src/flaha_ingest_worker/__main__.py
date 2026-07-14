"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Reference Worker Entrypoint
Introduction:
Reads one governed request and invokes the deterministic reference provider.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from protocol import RequestError, read_request
from reference_provider import run

def main():
    try:
        request = read_request()
    except RequestError as error:
        print(str(error), file=sys.stderr, flush=True)
        return 2
    return run(request)

if __name__ == "__main__":
    raise SystemExit(main())
