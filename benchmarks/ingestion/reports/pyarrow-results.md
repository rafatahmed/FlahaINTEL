<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: PyArrow Governed Benchmark Results
Introduction:
Records correctness, determinism, execution, resource, and limitation evidence.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# PyArrow governed benchmark results

Two correctness runs each produced 15 results with zero comparison failures,
zero determinism failures, and zero eager/threaded/incremental hash mismatches.
The stdlib validator ran before Arrow. Arabic, nulls, mixed values, duplicates,
leading zeros, exact decimal text, and UTC timestamp text were preserved. Invalid
CSV and non-finite JSON were quarantined. Ordinary JSON used strict stdlib decode
followed by `pyarrow.Table.from_pylist`; it is not native Arrow JSON parsing.

CSV eager/threaded used `pyarrow.csv.read_csv` and returned a materialized
`Table`. Incremental CSV used single-threaded `pyarrow.csv.open_csv`, iterated
record batches, and never called `read_all()`. JSONL used `pyarrow.json.read_json`
or feature-detected `pyarrow.json.open_json`. All paths used explicit UTF-8,
delimiter, quoting, null, invalid-row error, dictionary, schema, and block options.

The accepted 10k/100k inputs retained SHA-256
`d78862966a8ff02f60ca7c3713eff48455e49baf402de46497f1f48770bbd95d`
and `a12590d8330e280d357b94e14b9b599b94b6ca9f0996ccc465149f5154a1ab5e`.
At 10k, eager/threaded/incremental wall times were 1.148/1.163/1.041 seconds.
At 100k they were 4.866/5.059/4.399 seconds. Hashes matched across modes. Arrow
peak-pool values were 3.9–5.5 MB at 10k and 14.5–19.6 MB at 100k.

These are single resource runs, not superiority evidence. The Windows process
sampler followed the small venv redirector, so its working-set and CPU values are
null or implausible and are rejected. Arrow pool metrics exclude Python objects
and other native/process allocations. Incremental parsing avoided a full Arrow
table, but every batch became Python row dictionaries and all normalized rows
were retained; therefore this gate does not prove bounded end-to-end memory.
The optional 500k case was skipped because 10k/100k answer the governed gate and
the measurement limitation would remain.
