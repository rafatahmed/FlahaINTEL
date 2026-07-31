<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Research Desk Frame (4R)
Introduction:
Short system-level pointer for Stage D research desk. Full multi-domain
scope and citation standard live in gate-4r-research-desk-scope.md.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-08-01
-->

# Research desk frame (Stage D)

## Authoritative scope

**Full scope (multi-domain, citation law, layers, gate map):**  
→ [`docs/program/gates/gate-4r-research-desk-scope.md`](gates/gate-4r-research-desk-scope.md)

That document is the Stage D boundary. It is **not** narrowed to any single paper, parameter, or sister product.

---

## Position in FlahaINTEL

```text
EYES          Sources · Submit · Literature library · Markets harvest
MUSCLES       Jobs · artifacts · packs · analytics · research index
BACKBONE      Artifacts · evidence · audit
BRAIN         Review · citation integrity · feed policies · desk browse
FEEDS         4I-B handoff → SOIL | CALC | FAST (optional, separate)
```

Research desk is **not** a fourth sister product. It is how PA **catalogues, cites, finds, and assembles** governed knowledge across **all PA / agribusiness domains** — plant production, soil, weather/environment, irrigation, nutrition, markets-as-context, and more.

Sister products **consume some extracts**. They do **not** define the outer walls of Research.

---

## Layers (summary)

| Layer | Role |
|-------|------|
| **L1** | Evidence artifact (immutable) |
| **L2** | Citable literature/source record (**APA 7th / ASA–CSSA–SSSA**) |
| **L3** | Structured extracts (claims) — APPROVED before default claim browse |
| **L4** | Research index (finder) |
| **L5** | Collections for writing / dossiers (**4R-B**) |

**Aboutness ≠ claim:** keywords describe the source; approved extracts are usable assertions.

---

## Citation default (summary)

| Item | Lock |
|------|------|
| Field practice | **ASA / CSSA / SSSA** handbook |
| System | **APA 7th** author–year (never numbered as desk default) |
| DOI | Always when available; verify before “citation-complete” |
| Export | APA-compatible bibliography from collections (4R-B) |

Details: scope doc §6.

---

## Gate map (summary)

| Gate | Outcome |
|------|---------|
| **4R-A** | Topic index (4R-A.1 = APPROVED **packs** only — partial L4) |
| **4R-L** | Literature source records (L2, multi-domain intake) — *planning name* |
| **4R-X** | Extract depth at scale (L3) — *planning name* |
| **4R-B** | Collections + APA bibliography export |
| **4R-E** | Evidence-attach UX — *planning name* |

Charter: [`gate-4r-a-research-topic-index.md`](gates/gate-4r-a-research-topic-index.md) for 4R-A.

---

## Do not confuse with

| System | Role |
|--------|------|
| **Markets analytics** | Price time series — not the literature library |
| **Knowledge product lanes** | Product-oriented packs (subset of L3) |
| **4I-B handoff** | Export **out** to product process |
| **FKP** | Frozen-thin methodology authority — not INTEL ops library |
| **Sample seed packs** | Fixtures — not the real multi-domain library |

---

## Recommended program order

1. ~~**Owner accept** full scope~~ **DONE** (`gate-4r-research-desk-scope.md`)  
2. ~~**4R-L.1** literature records~~ **DONE**  
3. ~~**4R-B.1** collections + APA bibliography~~ **DONE** (`gate-4r-b-research-collections.md`)  
4. ~~**4R-E thin** attach-claim from literature~~ **DONE**  
5. **Operate** real library → collections → draft claims → human approve packs  
6. Scale extracts (**4R-X**) where richer claim templates are needed  

**Parallel:** historical market fill remains Markets operate; it does not replace Stage D literature.

### Operator (Research desk)

```powershell
npm run knowledge:register-literature -- --approve
npm run knowledge:rebuild-research-index
# Knowledge → Research → Literature | Collections | Topics
# Collections: create dossier → add literature → Copy APA bibliography
# Literature: Draft claim on pack (creates DRAFT REFERENCE item with APA evidence)
```
