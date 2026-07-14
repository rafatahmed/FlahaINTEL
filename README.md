# FlahaINTEL

A small OSINT web application that collects public RSS news and presents it in a searchable feed.

## Requirements

- Node.js 20 or newer
- PostgreSQL on `localhost:5432`
- An existing database named `flaha_intel`

## Setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and replace `<PASSWORD>` with the local PostgreSQL password.
3. Generate the Prisma client with `npm run prisma:generate`.
4. After reviewing the schema, create the first migration from `apps/api`.
5. Run the API and web app in separate terminals:
   - `npm run dev --workspace=@flaha-intel/api`
   - `npm run dev --workspace=@flaha-intel/web`

The API listens on port 3003 and the web app on port 5174 by default. Both development commands load configuration from the root `.env`. Enabled RSS sources are collected on the configured in-process interval and can also be collected manually in the UI.

## Commands

- `npm run build` — build both applications
- `npm test` — run API unit tests
- `npm run prisma:generate` — generate the Prisma client without changing the database
