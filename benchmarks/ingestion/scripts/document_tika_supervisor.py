"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Governed Apache Tika Supervisor
Introduction:
Runs one local artifact in a bounded portable-Java child process and then exits.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
RUNTIME=ROOT/'.benchmark-runtime/document-tika-3.3.1'
JAR=RUNTIME/'tika-app-3.3.1.jar'
CONFIG=ROOT/'benchmarks/ingestion/config/document-tika-parser-allowlist.xml'
ALLOWED={'.pdf','.docx','.pptx','.rtf','.txt'}


def extract(path:Path, timeout_seconds:int=30, maximum_output:int=2_000_000)->dict[str,object]:
    source=path.resolve(); corpus=(ROOT/'benchmarks/ingestion/corpus').resolve()
    if not source.is_relative_to(corpus) or source.suffix.lower() not in ALLOWED: raise ValueError('Only allowlisted governed corpus artifacts are accepted')
    java=next((RUNTIME/'jre').glob('*/bin/java.exe'))
    environment={k:v for k,v in os.environ.items() if k.upper() not in {'CLASSPATH','JAVA_TOOL_OPTIONS','JDK_JAVA_OPTIONS','JAVA_HOME','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY'}}
    environment.update({'NO_PROXY':'*','no_proxy':'*'})
    temporary=tempfile.mkdtemp(prefix='tika-',dir=RUNTIME)
    command=[str(java),'-Xms64m','-Xmx512m',f'-Djava.io.tmpdir={temporary}',f'-Dpdfbox.fontcache={temporary}',f'-Duser.home={temporary}','-Djava.awt.headless=true','-jar',str(JAR),f'--config={CONFIG}','-t',str(source)]
    process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=environment)
    timed_out=False
    try: stdout,stderr=process.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired:
        timed_out=True
        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],capture_output=True,check=False)
        stdout,stderr=process.communicate()
    try: shutil.rmtree(temporary);temp_cleaned=True;cleanup_error=None
    except OSError as error: temp_cleaned=False;cleanup_error=f'{type(error).__name__}: {error}'
    if timed_out: return {'candidate':'apache-tika','version':'3.3.1','classification':'TIMEOUT','text':'','exitCode':process.returncode,'privateTemp':Path(temporary).name,'privateTempCleaned':temp_cleaned,'cleanupError':cleanup_error}
    output=stdout[:maximum_output]; classification='SUCCESS' if process.returncode==0 and len(stdout)<=maximum_output else 'OUTPUT_LIMIT' if len(stdout)>maximum_output else 'PARSE_ERROR'
    return {'candidate':'apache-tika','version':'3.3.1','classification':classification,'text':output.decode('utf-8','replace'),'exitCode':process.returncode,'stderr':stderr[:65536].decode('utf-8','replace'),'outputBytes':len(stdout),'privateTemp':Path(temporary).name,'privateTempCleaned':temp_cleaned,'cleanupError':cleanup_error}
