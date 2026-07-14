# Contract fixture expectations

Shape-invalid JSON fixtures are mapped to schemas by directory/name during Gate 3B validation. Their intended failure is encoded in the filename.

The following fixtures are intentionally shape-valid but invalid at a later validation layer:

- `invalid/policy/output-outside-staging-prefix.json` passes `ArtifactReference` shape but violates the active `PolicySnapshot` allocation.
- `invalid/sequencing/progress-after-result.jsonl` contains shape-valid lines but violates the terminal rule.
- `invalid/sequencing/multiple-terminal-results.jsonl` contains shape-valid lines but contains two terminal results.

Artifact-key attack fixtures must fail schema shape validation: traversal, absolute Windows and POSIX paths, UNC and device paths, ADS, and reserved Windows device components.

Fixtures contain no live credentials, malware, network destinations, or large inline payloads.
