<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Gate 4M-0 Global Market Data Model
Introduction:
Charter for the country-agnostic market price model before Qatar/Jordan onboarding.

Created by: Rafat Al Khashan
Created date: 2026-07-30
Last modified: 2026-07-30
-->

# Gate 4M-0 — Global market data model

## Status

**APPROVED** by product owner (2026-07-30) · **IMPLEMENTED** (schema + validation + API; harvest later)

## Purpose

Define one market-price data model that works **anywhere in the world**.  
Country is a field, not a separate product. First implementations: Qatar, then Jordan.

## Maps to final product

- Metaphor: **Eyes + Muscles** (market)
- Outcomes: **O1** (markets), **O4** (governed sources)
- Lock: `docs/program/flahaintel-final-product-lock.md` §0, §7 Stage B

## Scope (in)

- Logical schema: country, market id/name, crop/commodity, unit, currency, price, observed date/time, source evidence link, ingestion job/artifact refs  
- Uniqueness rules for daily rows  
- Retention target: ≥ 365 days per market  
- Place for human review before “official series” use  

## Scope (out)

- Live Qatar/Jordan scraping (gates 4M-A / 4M-B)  
- UI charts (later 4M-D)  
- Automatic trading advice  

## Acceptance (when implemented)

- [x] Schema/migration or approved JSON contract documented (`MarketChannel`, `MarketPriceObservation`)  
- [x] Works for two different countries without code forks (countryCode field + multi-country tests)  
- [x] Evidence link required for each price batch  
- [x] Tests for uniqueness and currency/unit validation (`market/validation.test.ts`)

## Depends on

Phase 3N backbone; product owner approval of this charter.
