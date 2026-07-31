<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: FlahaCALC + FlahaFAST Recon — Irrigation / Nutrition Handoff Map
Introduction:
Maps FlahaCalc (ETo, Kc, irrigation, water balance) and FlahaFast (water quality,
formulations, nutrient targets) product surfaces so FlahaINTEL 4I packs and
export envelopes can inform sister products without auto-writing product code.

Created by: Rafat Al Khashan
Created date: 2026-07-31
Last modified: 2026-07-31
-->

# FlahaCALC + FlahaFAST recon (for FlahaINTEL 4I)

**Two products — never one.** Recon lives in one doc for convenience only; INTEL packs, intake classes, and handoff envelopes keep them **separate**.

| Product | Path | Domain (LOCKED) |
|---------|------|-----------------|
| **FlahaCALC** | `C:\Users\rafat\repo\Flaha\FlahaCalc` | **Irrigation & weather:** ETo (FAO-56 / ASCE), crop Kc, irrigation depth/volume, water balance, landscape KL |
| **FlahaFAST** | `C:\Users\rafat\repo\Flaha\FlahaFast` | **Nutrient management:** water profiles, salt catalog, formulations, stoichiometry / stock / batch, crop nutrient targets |

**Rule (LOCKED, same as 4S):** FlahaINTEL **informs** each product via **its own** governed packs and handoff envelopes. It **never** auto-writes product algorithms, and **never** treats irrigation and nutrients as a single product handoff.

---

## 1. Product roles (division of labor)

```text
                    ┌─────────────────────────┐
                    │      FlahaINTEL         │
                    │  Eyes + packs + review  │
                    └───────────┬─────────────┘
           IRRIGATION / NUTRITION packs + export
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                                           ▼
   ┌──────────────┐                           ┌──────────────┐
   │  FlahaCalc   │                           │  FlahaFast   │
   │  Water need  │                           │  Nutrients   │
   │  ETo→ETc→I   │                           │  recipe math │
   └──────┬───────┘                           └──────┬───────┘
          │                                          │
          └──────────── soil / water context ────────┘
                         (FlahaSOIL bridge already 4S)
```

| Concern | Owner product | INTEL theme |
|---------|---------------|-------------|
| Reference ETo, weather, methods | FlahaCalc | `IRRIGATION` + `EQUATION` |
| Crop Kc, stages, p, root depth | FlahaCalc crop DB | `IRRIGATION` |
| Net/gross irrigation, efficiency, runtime | FlahaCalc irrigation services | `IRRIGATION` |
| Soil water (θFC, θWP, TAW/RAW) | FlahaCalc soil params **and** FlahaSOIL physics | `SOIL` + `IRRIGATION` |
| Landscape KL (WUCOLS-style) | FlahaCalc landscape | `IRRIGATION` |
| Irrigation water EC / ions for fertigation | FlahaFast water profile (+ soil irrigation EC notes) | `IRRIGATION` / `NUTRITION` |
| Element targets (N,P,K,Ca… ppm) | FlahaFast crop recommendation | `NUTRITION` |
| Salt stoichiometry, stock solutions | FlahaFast calculation engine | `NUTRITION` + `EQUATION` |

---

## 2. FlahaCalc — structure and science surface

### 2.1 Stack

- **Backend:** Express + Prisma + PostgreSQL (`backend/`)
- **Frontend:** React CRA (`frontend/`)
- **Science refs:** FAO-56 Paper 56; ASCE standardized; landscape `WUCOLS_KL_V1`
- **Route contract (locked):** project workspace primary; ETo at `/calculator`; irrigation planning at `/analytics/advanced` — see `docs/ROUTE_CONTRACT.md`

### 2.2 Calculation chain (product truth)

```text
Weather / EPW / manual inputs
        │
        ▼
   ETo  (FAO56 | ASCE; hourly | daily | monthly)
        │
        ▼
   Kc (stage or interpolated)  →  ETc = Kc × ETo
        │
        ▼
   Net I = max(0, ETc − Pe)     [quick: Pe ≈ 0.8×P; project WB: storage-limited Pe]
        │
        ▼
   Gross I = Net / applicationEfficiency
        │
        ▼
   Volume (m³) = Gross_mm × area_ha × 10
        │
        ▼
   Runtime hours = Gross / verifiedApplicationRate  (catalogue rate = illustrative only)
```

Defensible stop-levels in `irrigation-requirement.service.ts`:

`REFERENCE_ET_ONLY` → `PLANT_WATER_DEMAND` → `NET_IRRIGATION` → `GROSS_IRRIGATION` → `VOLUME` → `RUNTIME`

### 2.3 Crop coefficient database (single source in Calc)

**File:** `backend/src/data/crop-parameters.ts`  
**API:** `GET /api/irrigation/crops`  
**Reference:** FAO-56 Tables 11, 12, 22

| Field | Meaning | Unit |
|-------|---------|------|
| `name` | Crop display name | — |
| `type` | Cereals / Vegetables / Fruit Trees / Forages / Industrial | — |
| `kc_ini` / `kc_mid` / `kc_end` | Stage crop coefficients | dimensionless |
| `stage_ini` / `stage_dev` / `stage_mid` / `stage_late` | Stage lengths | days |
| `root_depth` | Effective rooting depth Zr | m |
| `p` | Depletion fraction (no stress) | 0–1 |

**Crops present (17):** Wheat, Maize (Corn), Rice, Tomato, Potato, Onion, Cabbage, Lettuce, Citrus, Apple, Grape, Olive, Date Palm, Alfalfa, Grass (turf), Cotton, Sugarcane.

### 2.4 Irrigation systems catalogue

| Name | Efficiency | Catalogue application rate (mm/h) |
|------|------------|-------------------------------------|
| Drip Irrigation | 0.90 | 4 |
| Sprinkler | 0.75 | 8 |
| Center Pivot | 0.80 | 10 |
| Flood/Furrow | 0.60 | 15 |
| Subsurface Drip | 0.95 | 3 |

**API:** `GET /api/irrigation/systems` · `POST /api/irrigation/calculate`

### 2.5 Soil water parameters (Calc-side FAO-56 Table 19)

**File:** `backend/src/data/soil-parameters.ts`  
USDA texture → `fieldCapacity`, `wiltingPoint`, `awc` (m³/m³).  
Used by water-balance engine for **TAW / RAW**:

\[
TAW = 1000 \times (\theta_{FC} - \theta_{WP}) \times Z_r,\quad RAW = p_{adj} \times TAW
\]

Daily balance: \(D_r(i) = D_r(i-1) + ET_c(i) - P_e(i) - I(i)\)

**Overlap with FlahaSOIL:** SOIL reports plant-available water / texture from Saxton–Rawls engines; Calc uses FAO-56 table defaults unless zone/project overrides. INTEL must **not** silently merge these — comparison notes only (same rule as 4S-D).

### 2.6 Landscape (non-agricultural Kc)

**Method version:** `WUCOLS_KL_V1`  
\[
K_L = K_s \times K_d \times K_{mc} \times K_e \times K_{exp},\quad ET_L = ET_o \times K_L
\]

Species groups: TURF, TREES, PALMS, SHRUBS, GROUNDCOVERS, SEASONAL_FLOWERS, MIXED, NEWLY_ESTABLISHED.

### 2.7 Key API / service map (Calc)

| Surface | Evidence |
|---------|----------|
| ETo calculate / history | `calculation.routes.ts`, `calculation.service.ts` |
| Irrigation crops/systems/calc | `irrigation.routes.ts` |
| Water balance | `water-balance.service.ts` |
| Scheduling / recommendations | `scheduling-*.service.ts`, `smart-recommendations.service.ts` |
| Project intelligence (alerts, trends, decision) | `intelligence.routes.ts` under projects |
| Applied irrigation logs | `applied-irrigation-logs.*` |

### 2.8 What INTEL should **not** do to Calc

- Patch `cropDatabase` or efficiency tables from packs  
- Push automatic irrigation events or applied logs  
- Change FAO-56 / ASCE intermediate formulas  
- Treat catalogue application rates as verified field rates  

---

## 3. FlahaFast — structure and nutrition surface

### 3.1 Stack

- **Backend:** Express + Prisma + PostgreSQL (`server/`)
- **Frontend:** React Vite (`client/`)
- **Algorithm lineage:** HydroBuddy Pascal matrix solver (stoichiometry, DOF, stock split)
- **Docs of truth:** `docs/Truth/*`, `docs/HYDROBUDDY_TECHNICAL_REFERENCE.md` preferred over root marketing

### 3.2 Domain hierarchy

```text
User
 ├── Element[]              (symbol, atomicWeight)
 ├── Salt[] + SaltElement[]  (fertilizer salts, % composition)
 ├── WaterProfile + WaterElement[]   (source water ions + EC/pH)
 └── Formulation
      ├── FormulationSalt[]
      └── TargetElement[]    (target concentrations)
```

### 3.3 Water quality model (product keys)

**Types:** `server/src/types/waterQuality.ts`  
**Routes:** `/api/water-quality` CRUD + `POST /api/water-quality/analyze`

| Field | Unit (typical) | Notes |
|-------|----------------|-------|
| `ph` / `pH` | pH | Profile + analysis |
| `ec` | dS/m or mS/cm (confirm UI unit on export) | Water profile required field |
| `temperature` | °C | Optional analysis |
| `alkalinity` | often ppm as CaCO₃ | Optional |
| `hardness` | often ppm | Optional |
| `elements[]` | `symbol` + `concentration` + `ppm` \| `mmol/L` | Ca, Mg, Na, K, S, Cl, … |
| `calcium`, `magnesium`, `sulfur`, `bicarbonate` | convenience aliases on params | |

Presets categories: `municipal` \| `well` \| `distilled` \| `custom`.

### 3.4 Nutrient / crop recommendation targets

**Service:** `CropRecommendationService.ts`  
**Routes:** `/api/crop-types`, `POST .../recommendations`, `compare`, `water-quality-adjustments`

**Element symbols (ppm-style targets):** N, P, K, Ca, Mg, S, Fe, Mn, Zn, B, Cu, Mo  

**Crop type buckets (profiles):** Leafy greens, Fruiting vegetables, Herbs, Berries, Microgreens (+ stages seedling / vegetative / mature / …)

**EC ranges (example product defaults):** e.g. Fruiting vegetables optimal ~2.0 (min 1.5 / max 3.0); Leafy greens ~1.2  

**pH ranges:** typically ~5.5–6.5 depending on crop bucket  

### 3.5 Calculation API surface (Fast)

| Endpoint family | Purpose |
|-----------------|---------|
| `POST /calculate/stoichiometry` | Matrix solve salt masses for targets |
| `POST /calculate/scaling` | Scale batch volume |
| `POST /calculate/precision` | Precision tuner |
| `POST .../batch`, stock-solution, tune, split | Stock / batch prep (HydroBuddy-style) |
| Salt CRUD `/salts` | Fertilizer library |
| Formulation CRUD `/formulation` | Saved recipes |

### 3.6 What INTEL should **not** do to Fast

- Rewrite salt % compositions or Element atomic weights  
- Auto-create formulations or stock recipes in production Fast  
- Override HydroBuddy matrix / DOF (S default) behavior  
- Present literature nutrient ppm as “Fast targets” without human review  

---

## 4. Shared key catalog for INTEL extracts (handoff identity)

Use these **wire keys** in pack `structured.parameter` / equation notes so 4I packs align to products (parallel to `flahaSoilParameters` for 4S).

### 4.1 FlahaCalc irrigation keys

| Wire key | Unit | Product home |
|----------|------|--------------|
| `etoMm` | mm/day (or period) | ETo engine |
| `methodEto` | enum `FAO56` \| `ASCE` | calculation method |
| `timeScale` | `hourly` \| `daily` \| `monthly` | calculation scale |
| `kc` | — | stage / interpolated Kc |
| `kcIni` / `kcMid` / `kcEnd` | — | crop DB |
| `growthStage` | `initial` \| `development` \| `mid` \| `late` | irrigation calc |
| `cropName` | string | crop DB name |
| `etcMm` | mm | Kc × ETo |
| `rainfallMm` | mm | input |
| `effectiveRainfallMm` | mm | Pe |
| `effectiveRainfallMethod` | `QUICK_FRACTION_0_8` \| `NONE` | quick estimate |
| `netIrrigationMm` | mm | net I |
| `grossIrrigationMm` | mm | gross I |
| `applicationEfficiency` | 0–1 | system efficiency |
| `irrigationSystemName` | string | systems catalogue |
| `applicationRateMmPerH` | mm/h | verified vs catalogue |
| `areaHa` | ha | volume |
| `volumeM3` | m³ | volume |
| `runtimeHours` | h | operational only if verified rate |
| `rootDepthM` | m | Zr |
| `depletionFractionP` | 0–1 | p |
| `fieldCapacity` | m³/m³ | soil params (Calc FAO table) |
| `wiltingPoint` | m³/m³ | soil params |
| `awc` | m³/m³ | available water capacity |
| `tawMm` | mm | total available water |
| `rawMm` | mm | readily available water |
| `depletionMm` | mm | Dr |
| `ksStress` | 0–1 | stress coefficient |
| `landscapeKl` | — | KL product |
| `landscapeMethod` | `WUCOLS_KL_V1` | landscape |

### 4.2 FlahaFast nutrition / water keys

| Wire key | Unit | Product home |
|----------|------|--------------|
| `solutionEc` | dS/m (confirm) | water profile / crop EC range |
| `solutionPh` | pH | water profile / crop pH |
| `waterElementPpm` | ppm | water element concentration (pair with `elementSymbol`) |
| `targetElementPpm` | ppm | formulation / crop target (pair with `elementSymbol`) |
| `elementSymbol` | N,P,K,Ca,Mg,S,Fe,… | Element / TargetElement |
| `cropTypeBucket` | string | CropRecommendationService keys |
| `growthStageNutrient` | string | seedling / vegetative / … |
| `saltName` / `saltFormula` | — | Salt catalog |
| `saltElementPercent` | % | SaltElement.percentage |
| `batchVolumeL` | L | scaling |
| `alkalinity` | product unit | water quality |
| `hardness` | product unit | water quality |

### 4.3 Cross-product caution flags (always human)

| Topic | Risk if auto-merged |
|-------|---------------------|
| EC soil (SOIL) vs irrigation water EC (Calc/Fast) | Different media and methods |
| θFC table (Calc FAO-19) vs SOIL Saxton–Rawls | Different models |
| Crop Kc Tomato (Calc) vs “Tomatoes” nutrient prefs (Fast) | Related crop, different domains |
| Catalogue drip rate vs verified field rate | Runtime safety |

Every extract must assert:

```json
{
  "doesNotAutoUpdateFlahaCALC": true,
  "doesNotAutoUpdateFlahaFAST": true,
  "doesNotAutoUpdateFlahaSOIL": true
}
```

(Keep SOIL flag for continuity with 4S validators where shared.)

---

## 5. Export envelope (4I-B target shape — design)

Human-approved packs export a **read-only** JSON envelope for PA / sister-product review (no write API into Calc/Fast in 4I-B):

```json
{
  "envelopeVersion": "flaha-intel-product-handoff-v1",
  "generatedAt": "ISO-8601",
  "tenantCode": "flaha-local",
  "targets": ["FlahaCALC"],
  "autoApplyBlocked": true,
  "sourcePacks": [{ "code": "...", "theme": "IRRIGATION", "reviewState": "APPROVED" }],
  "equations": [{ "equationId": "ETc_Kc_ETo", "form": "ETc = Kc * ETo", "product": "FlahaCALC" }],
  "parameters": [{ "key": "kcMid", "value": 1.15, "unit": null, "cropName": "Tomato", "confidence": "literature-note", "evidenceItemId": "..." }],
  "notes": ["Human must review before any product change process."]
}
```

**Out of scope for 4I:** TCP calls into Calc/Fast to mutate DB; automatic promotion of Kc or nutrient ppm into product seeds.

---

## 6. Mapping to existing INTEL foundation

| Already in INTEL | Use for 4I |
|------------------|------------|
| `KnowledgePack` theme `IRRIGATION` / `NUTRITION` | Pack shell (4S-A) |
| Extract kinds THRESHOLD / METHOD / EQUATION / NOTE / REFERENCE | 4S-B |
| Sample pack `irrigation-water-saving-notes-v1` | Starter; extend with CALC/FAST keys |
| FlahaSOIL comparison + report bridge | Soil water side only; do not overload for Kc/nutrients |
| Market analyst pack pattern | Optional later: climate/market context tags on irrigation packs |

---

## 7. Gate split recommendation

| Gate | Deliverable |
|------|-------------|
| **4I-A** | Irrigation/nutrition pack template + CALC/FAST parameter catalog + sample packs (DRAFT) |
| **4I-B** | Handoff export envelope + API/CLI + UI download; rules doc; **no** product write adapters |

---

## 8. Residual gaps (product repos, not INTEL)

| Gap | Where |
|-----|--------|
| EC unit string consistency on Fast water profile (dS/m vs mS/cm display) | Confirm at export time against live UI |
| Calc incomplete MVP notes (billing, Docker) | `FlahaCalc/docs/REPOSITORY_SCOPE.md` — does not block handoff identity |
| Fast calc pipeline / test debt | `FlahaFast` Truth docs — INTEL must not depend on Fast write APIs |
| No shared Flaha monorepo package for Kc/nutrients | Deliberate: each product owns tables; INTEL holds **literature identity** only |

---

## 9. Sources checked (local paths)

**FlahaCalc**

- `docs/API.md`, `docs/ROUTE_CONTRACT.md`, `docs/REPOSITORY_SCOPE.md`
- `docs/science/LANDSCAPE_COEFFICIENT_METHOD.md`
- `backend/src/data/crop-parameters.ts`, `soil-parameters.ts`
- `backend/src/routes/irrigation.routes.ts`, `intelligence.routes.ts`, `calculation.routes.ts`
- `backend/src/services/irrigation-requirement.service.ts`, `water-balance.service.ts`, `calculation.service.ts`

**FlahaFast**

- `docs/API_DOCUMENTATION.md`, `docs/SYSTEM_OVERVIEW.md`, `docs/REPOSITORY_SCOPE.md`, `docs/HYDROBUDDY_TECHNICAL_REFERENCE.md`
- `server/prisma/schema.prisma`
- `server/src/routes/api.ts`, `calculationRoutes.ts`, `cropRecommendationRoutes.ts`
- `server/src/types/waterQuality.ts`, `types/nutrient.ts`
- `server/src/services/CropRecommendationService.ts`
