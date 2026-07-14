"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Windows Process Resource Measurement
Introduction:
Measures child wall time, CPU, peak working set, exit status, and bounded output.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
"""
from __future__ import annotations
import subprocess, time

def measure(command: list[str], env: dict[str,str], cwd: str) -> dict[str,object]:
    start=time.perf_counter(); process=subprocess.Popen(command,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding="utf-8")
    peak=0; cpu=None
    while process.poll() is None:
        try:
            sample=subprocess.run(["powershell.exe","-NoProfile","-Command",f"$p=Get-Process -Id {process.pid} -ErrorAction Stop; \"$($p.PeakWorkingSet64)|$($p.CPU)\""],capture_output=True,text=True,timeout=2)
            if sample.returncode==0:
                memory,cpu_text=sample.stdout.strip().split("|",1); peak=max(peak,int(memory)); cpu=float(cpu_text) if cpu_text else cpu
        except (OSError,ValueError,subprocess.SubprocessError): pass
        time.sleep(.02)
    stdout,stderr=process.communicate(); elapsed=time.perf_counter()-start
    return {"wallSeconds":elapsed,"cpuSeconds":cpu,"peakWorkingSetBytes":peak or None,"exitCode":process.returncode,"stdout":stdout[:65536],"stderrBytes":len(stderr.encode()),"warnings":[line[:512] for line in stderr.splitlines()]}
