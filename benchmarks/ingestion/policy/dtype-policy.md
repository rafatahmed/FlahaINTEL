<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Dataset Dtype Policy
Introduction:
Defines explicit schema, evidence-bearing inference, and text-preserving modes.

Created by: Rafat Al Khashan
Created date: 2026-07-15
Last modified: 2026-07-15
-->

# Dataset dtype policy

`STRICT_SCHEMA` requires ordered column names and a declared dtype for every column.
Missing or extra columns, invalid values, or implicit coercion fail. Supported
categories are string, integer, decimal, float, boolean, date, datetime, categorical,
null, and unknown. `unknown` is never valid in strict mode. Decimal values serialize
as exact strings. Boolean values are exactly `true` or `false` unless policy declares
another mapping. Date and datetime lexical validation is deterministic and UTC is
preferred for instants.

`INFER_WITH_EVIDENCE` records pandas' raw dtype plus bounded representative samples.
Inference is non-authoritative and requires later policy or analyst approval.

`TEXT_PRESERVING` loads values as strings and applies only declared null tokens. It is
the default for uncertain external tabular data because Unicode, leading zeroes, and
decimal spelling remain observable.
