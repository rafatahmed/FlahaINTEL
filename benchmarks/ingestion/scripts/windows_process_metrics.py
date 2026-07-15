"""
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Windows Process Tree Resource Sampler
Introduction: Samples candidate process trees and benchmark temporary storage without third-party packages.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
"""

from __future__ import annotations

import ctypes
import shutil
import statistics
import subprocess
import time
from ctypes import wintypes
from pathlib import Path

TH32CS_SNAPPROCESS = 0x00000002
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_VM_READ = 0x0010


class PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD), ("th32ProcessID", wintypes.DWORD),
                ("th32DefaultHeapID", ctypes.c_size_t), ("th32ModuleID", wintypes.DWORD), ("cntThreads", wintypes.DWORD),
                ("th32ParentProcessID", wintypes.DWORD), ("pcPriClassBase", wintypes.LONG), ("dwFlags", wintypes.DWORD),
                ("szExeFile", wintypes.WCHAR * 260)]


class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t), ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t), ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t)]


kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
psapi = ctypes.WinDLL("psapi", use_last_error=True)


def process_table() -> dict[int, tuple[int, str]]:
    snapshot = kernel32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
    entry = PROCESSENTRY32W(); entry.dwSize = ctypes.sizeof(entry); result = {}
    if kernel32.Process32FirstW(snapshot, ctypes.byref(entry)):
        while True:
            result[int(entry.th32ProcessID)] = (int(entry.th32ParentProcessID), entry.szExeFile)
            if not kernel32.Process32NextW(snapshot, ctypes.byref(entry)): break
    kernel32.CloseHandle(snapshot)
    return result


def descendants(root_pid: int, table: dict[int, tuple[int, str]]) -> set[int]:
    found = {root_pid}
    changed = True
    while changed:
        before = len(found); found.update(pid for pid, (parent, _) in table.items() if parent in found); changed = len(found) != before
    return found


def working_set(pid: int) -> int | None:
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, False, pid)
    if not handle: return None
    counters = PROCESS_MEMORY_COUNTERS(); counters.cb = ctypes.sizeof(counters)
    ok = psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb); kernel32.CloseHandle(handle)
    return int(counters.WorkingSetSize) if ok else None


def directory_bytes(path: Path) -> int:
    if not path.exists(): return 0
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())


def sampled_run(command: list[str], *, cwd: Path, env: dict[str, str] | None, temp_root: Path, timeout: float = 30) -> tuple[subprocess.CompletedProcess[str], dict[str, object]]:
    start_temp = directory_bytes(temp_root); start_free = shutil.disk_usage(cwd).free; started = time.perf_counter()
    process = subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    memory_samples=[]; count_samples=[]; names=set(); peak_temp=start_temp; lowest_free=start_free
    while process.poll() is None:
        if time.perf_counter() - started > timeout:
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True); raise subprocess.TimeoutExpired(command, timeout)
        table=process_table(); pids=descendants(process.pid, table); values=[value for pid in pids if (value:=working_set(pid)) is not None]
        if values: memory_samples.append(sum(values)); count_samples.append(len(values)); names.update(table[pid][1] for pid in pids if pid in table)
        peak_temp=max(peak_temp,directory_bytes(temp_root)); lowest_free=min(lowest_free,shutil.disk_usage(cwd).free); time.sleep(0.02)
    stdout,stderr=process.communicate(); ended=time.perf_counter(); result=subprocess.CompletedProcess(command,process.returncode,stdout,stderr)
    metrics={"total_wall_ms":round((ended-started)*1000,3),"sample_count":len(memory_samples),"peak_process_tree_memory_bytes":max(memory_samples,default=None),"average_process_tree_memory_bytes":round(statistics.fmean(memory_samples),3) if memory_samples else None,"peak_process_count":max(count_samples,default=None),"observed_process_names":sorted(names),"temporary_disk_growth_bytes":max(0,peak_temp-start_temp),"starting_free_disk_bytes":start_free,"lowest_observed_free_disk_bytes":lowest_free}
    return result,metrics
