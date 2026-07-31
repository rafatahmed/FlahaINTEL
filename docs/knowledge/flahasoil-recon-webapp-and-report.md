<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaSOIL Recon — Web App Structure, Test Levels, Report Extract Map
Introduction:
Maps FlahaSOIL product hierarchy, three SoilTestLevel tiers, PDF report sections,
and what FlahaINTEL knowledge packs should extract for human comparison (not auto-update).

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# FlahaSOIL recon (for FlahaINTEL 4S)

**Repos:** `C:\Users\rafat\repo\Flaha\FlahaSoil` (authoritative product monorepo)  
**Sample report:** `FlahaSOIL-FLH-2026-001_8.pdf` (ADVANCED smoke report FLH-2026-001)  
**Rule:** FlahaINTEL **informs** comparison; it **never** auto-writes FlahaSOIL algorithms.

---

## 1. Web app structure (FlahaSOIL v2)

### Product hierarchy (binding)

```text
User / Organization
 └── Project                 (farm, trial, field block)
      └── SoilSample         (location + depth + date)
           └── SoilTest      (one lab/manual event; has testLevel)
                ├── SoilTextureInput
                ├── SoilChemistryInput
                ├── SoilLabValue[]          (raw lab readings + method)
                ├── SoilPhysicsResult       ← engine
                ├── SoilChemistryResult     ← engine
                ├── SoilInterpretation      ← engine
                └── SoilReport[]            ← versioned snapshot / PDF
                       └── FlahaCalc export (read-only projection)
```

Source: `FlahaSoil/docs/v2-product-workflow.md`.

### Primary routes (SPA)

| Path | Purpose |
|------|---------|
| `/` | Landing / public |
| `/login`, `/register` | Auth |
| Dashboard | Counts, recent activity |
| `/projects`, `/projects/:id` | Project list + detail (samples/tests) |
| `/soil-tests/new?projectId&sampleId` | **Wizard** input → calculate |
| `/soil-tests/:id` | Test detail (inputs + physics/chemistry/interpretation) |
| `/soil-tests/:id/report` | Full report (envelope + audit) |
| `/reports` | Cross-project report index |
| `/flahacalc-export` | Cross-app export |

### Scientific engines (packages)

| Package | Role |
|---------|------|
| `@flaha/soil-physics` | Texture triangle, water retention (Saxton–Rawls), Ksat, PAW, drainage |
| `@flaha/soil-chemistry` | CEC / bases / derived chemistry modes LAB \| ESTIMATED |
| `@flaha/soil-interpretation` | Severity classes, agronomic labels, recommendations |
| `@flaha/shared-types` | **SoilTestLevel standard** + coverage scoring + report level scope |

---

## 2. Reports are based on **three test levels** (LOCKED)

Every soil test declares `testLevel`. The report **declares that level honestly** and scopes sections by level. Levels are hierarchical; missing fields do **not** silently downgrade the level — coverage becomes Partial / Missing.

Authoritative code: `packages/shared-types/src/soil-test-level-standard.ts`  
Report section gating: `packages/shared-types/src/report-level-scope.ts`  
Docs: `docs/soil-test-level-standard.md`

### Level matrix (expected inputs)

| Level | Expected evidence (cumulative) | Best for |
|-------|--------------------------------|----------|
| **PRELIMINARY** | sand, silt, clay, organic matter, **pH**, **EC or TDS** | Reconnaissance, basic irrigation planning |
| **MODERATE** | PRELIMINARY **+** Ca, Mg, K, Na, Cl, N, P, lab-CEC (if lab reports it) | Routine agronomy, lime/gypsum, NPK, sodicity screen |
| **ADVANCED** | MODERATE **+** Fe, Mn, Zn, Cu, B, Mo, S, heavy metals, carbonate, bicarbonate, **SAR**, **ESP** (+ JSON extras) | Problem soils, high-value crops, full salinity/sodicity management |

**Rules**

1. Each level **includes** all lower levels.  
2. **No silent downgrade** of declared level when fields are missing.  
3. **Extras allowed** beyond declared level (supplementary).  
4. **Salinity slot:** EC **or** TDS satisfies PRELIMINARY.  
5. **Method matters:** ECe vs EC 1:5 are not interchangeable without conversion context (PDF methods annex).

### How level shapes the **report** (not only the form)

| Report capability | PRELIMINARY | MODERATE | ADVANCED |
|-------------------|:-----------:|:--------:|:--------:|
| Texture + OM + pH + salinity (EC/TDS) | ✓ | ✓ | ✓ |
| Exchange chemistry (Ca/Mg/K/Na, CEC, base sat.) | — | ✓ | ✓ |
| Sodicity assessment (SAR/ESP) as primary section | — | ✓ | ✓ |
| Advanced analytes (micros, S, CO₃/HCO₃, metals) | — | — | ✓ |
| Cation agronomy (CEC class, balance, Na risk) | limited | ✓ | ✓ |
| Medium/long recommendations horizon | limited | ✓ | ✓ |
| Charts beyond texture triangle | texture-focused | full | full |

Sample PDF **FLH-2026-001** is **ADVANCED** with **Partial** evidence (50% / 13 of 26 expected fields) — still ADVANCED on the cover, not silently rewritten to MODERATE.

---

## 3. Sample PDF report anatomy (FLH-2026-001)

6 pages · test level **ADVANCED** · report number **FLH-2026-001**

| Page / block | Content | Provenance |
|--------------|---------|------------|
| Cover | Report number, date, test level, sample id, location, client | Control |
| Executive summary | Overall condition; texture; salinity/sodicity severity; OM; WHC | Interpretation |
| Results table | PHYSICAL / CHEMICAL / RISK / INTERPRETATION rows | Inputs + engines |
| Salinity & sodicity status | ECe, SAR, ESP classes | Chemistry + interpretation |
| Agronomic recommendations | Medium-term actions, suitability matrix | Interpretation (scoped by level) |
| Evidence completeness | Declared level + % coverage | Coverage engine |
| Scientific figures | Texture triangle, water retention, base sat., cation balance | Physics/chemistry charts |
| Methods & provenance | Measured vs estimated vs model | Audit annex |
| Calculation summary | Engine version, chemistry mode LAB/ESTIMATED | Traceability |

### Concrete parameters seen on ADVANCED sample report

**Physical (inputs + physics engine)**

| Parameter | Unit | Example (FLH-2026-001) | Note |
|-----------|------|------------------------|------|
| Sand / silt / clay | % | 60 / 25 / 15 | Input; sum ≈ 100 |
| Organic matter | % | 2.50 | Input |
| USDA texture class | — | Sandy Loam | Classified |
| Field capacity (FC) | % v/v | 18.3 | Saxton–Rawls model |
| Wilting point (WP) | % v/v | 8.9 | Model |
| Plant-available water (PAW) | % v/v | 9.4 | FC − WP |
| Bulk density | g/cm³ | 1.59 | Estimated/default |
| Ksat | mm/h | 82.8 | Texture-dependent |
| Drainage / water holding class | — | Good / Low | Interpreted |

**Chemical (inputs + chemistry engine)**

| Parameter | Unit | Example |
|-----------|------|---------|
| pH (H₂O) | — | 7.20 |
| ECe | dS/m | 1.00 |
| CEC | cmol(+)/kg | 18.0 |
| Ca / Mg / K / Na | cmol(+)/kg | 11 / 3 / 0.6 / 0.4 |
| N / P | mg/kg | 25 / 18 |
| Salinity severity | class | None (from ECe) |
| SAR / ESP | — / % | 0.15 / 2.2% · None |

**Interpretation labels (agronomic classes)**  
pH, Salinity, CEC, Base saturation, Cation balance, Sodium risk, Water holding, Drainage, Organic matter, Compaction risk.

---

## 4. What FlahaINTEL should extract (for 4S packs / comparison)

Goal: literature/method notes and **human COMPARISON_NOTE** rows that align to FlahaSOIL **parameter keys** and **test levels** — not re-implement engines.

### A. Always tag extracts with test-level applicability

| Field on extract / pack | Meaning |
|-------------------------|---------|
| `soilTestLevels` | e.g. `["PRELIMINARY","MODERATE","ADVANCED"]` or a single level |
| `appliesFromLevel` | Lowest level where the parameter is expected (e.g. SAR → ADVANCED) |
| `parameter` | Align to FlahaSOIL keys: `pH`, `ecDsM`, `organicMatterPercent`, `sar`, `cec`, … |
| `unit` | Same family as FlahaSOIL report (dS/m, %, cmol(+)/kg, …) |
| `method` | Lab method identity (critical for EC method family) |
| `doesNotAutoUpdateFlahaSOIL` | Always `true` |

### B. Priority extract groups by level

| Group | Parameters (FlahaSOIL keys) | Typical levels |
|-------|----------------------------|----------------|
| Texture | sandPercent, siltPercent, clayPercent → textureClass | All |
| OM | organicMatterPercent | All |
| Reaction | pH | All |
| Salinity | ecDsM / tdsMgL (and method: ECe vs 1:5) | All |
| Water (engine) | fieldCapacity, wiltingPoint, plantAvailableWater, drainageClass | All (modelled) |
| Cations / CEC | ca, mg, k, na, cec, base saturation classes | MODERATE+ |
| Macros | n, p, cl | MODERATE+ |
| Sodicity | sar, esp | MODERATE+ / ADVANCED emphasis |
| Micros / S | fe, mn, zn, cu, b, mo, s | ADVANCED |
| Carbonates | carbonate, bicarbonate | ADVANCED |
| Metals | heavyMetalsJson panel | ADVANCED |

### C. Report-level extract kinds for INTEL packs

| extractKind | Use against FlahaSOIL |
|-------------|------------------------|
| `THRESHOLD` | Literature band for a parameter (e.g. ECe stress, pH range) |
| `METHOD` | Lab method that must match before compare |
| `COMPARISON_NOTE` | Human: literature vs report/product observation; `autoApplyBlocked: true` |
| `REFERENCE` | Method paper (e.g. Saxton & Rawls 2006, USDA texture) |
| `NOTE` | Evidence-completeness / partial panel caveats |

### D. What **not** to extract as “truth” without method

- Treating model FC/WP/Ksat as lab measurements  
- Mixing EC methods  
- Using BCSR cation-ratio triangles as yield prescriptions (FlahaSOIL itself marks this diagnostic-only)  
- Inferring a lower test level from partial coverage  

---

## 5. Comparison workflow implication (4S-B → 4S-D)

```text
Literature / pack THRESHOLD + METHOD
        │
        ▼
Human COMPARISON_NOTE
  product: FlahaSOIL
  parameter: ecDsM | pH | sar | …
  soilTestLevels: [PRELIMINARY|MODERATE|ADVANCED]
  literatureValue / range
  flahaSoilObservation: from report snapshot or engineer note
  recommendedHumanAction: review-in-PA | schedule-product-ticket | …
  autoApplyBlocked: true
        │
        ▼
Human product process (outside FlahaINTEL) if FlahaSOIL defaults change
```

**Reports differ by test level** → comparison notes **must** state which level(s) they apply to, or they mislead (e.g. SAR note on a PRELIMINARY report is out of scope for that report’s primary sections).

---

## 6. Alignment check vs current INTEL samples

| Current INTEL sample parameter | FlahaSOIL key | Levels |
|--------------------------------|---------------|--------|
| EC / dS/m | `ecDsM` (report: ECe) | PRELIMINARY+ |
| pH | `pH` | PRELIMINARY+ |
| organic_matter % | `organicMatterPercent` | PRELIMINARY+ |
| SAR | `sar` | ADVANCED (+ MODERATE sodicity screen) |
| irrigation_water_EC | related but **not** soil ECe — tag as water, not soil chemistry | advice path |

**Implemented alignment (2026-07-31):**  
- Parameter catalog: `apps/api/src/knowledgePack/flahaSoilParameters.ts`  
- Validation normalizes aliases (`EC`→`ecDsM`) and enforces / defaults `soilTestLevels` + `appliesFromLevel`  
- Sample packs reseeded to FlahaSOIL keys (samplesVersion 3)

---

## 7. Sources

| Source | Path / file |
|--------|-------------|
| Product workflow | `FlahaSoil/docs/v2-product-workflow.md` |
| Test level standard | `FlahaSoil/docs/soil-test-level-standard.md` |
| Level field matrix | `packages/shared-types/src/soil-test-level-standard.ts` |
| Report section scope | `packages/shared-types/src/report-level-scope.ts` |
| Input schemas | `backend/src/validation/schemas.ts` |
| Prisma models | `prisma/v2-schema.prisma` |
| Sample PDF | `Downloads/FlahaSOIL-FLH-2026-001_8.pdf` |
