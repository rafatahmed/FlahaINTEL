<!--
Flaha Agri Tech
Precision Agriculture Division
Copyright © 2026–2027 Flaha Agri Tech. All rights reserved.

Title: Ingestion Provider Core
Introduction:
Describes the lightweight control-plane provider catalogue, contracts, and selection framework.

Created by: Rafat Al Khashan
Created date: 2026-07-16
Last modified: 2026-07-16
-->

# Ingestion provider core

`@flaha-intel/ingestion-provider-core` owns provider identity, capability declarations, catalogue queries, eligibility, deterministic selection, typed fallback rules, request/result validation, provenance, and production-authorization enforcement.

It has no runtime dependencies and imports no application, Prisma, database, worker, artifact-store, provider SDK, or benchmark module. The existing JSON Schemas remain canonical for the external worker protocol. This package supplies the internal TypeScript control-plane model used before and after that boundary.

The built-in catalogue is benchmark-informed and immutable. Every descriptor is production unauthorized. Fake adapters exist only for unit tests; no production provider adapter is registered.
