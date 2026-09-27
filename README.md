# AnimalGuard — Livestock Disease Early Warning System (SIH26128)

A Smart India Hackathon 2.0 prototype for the **Government of Maharashtra** that detects and contains livestock/poultry disease outbreaks **before they spread** — combining **real satellite/soil/weather sensing**, **AI disease prediction**, **voice-native farmer reporting**, and a **veterinary response dashboard** with role-based privacy and a tamper-evident audit chain.

**A live, deployed demo is running here:** 👉 **https://animalguard.onrender.com/** (push to `main` auto-redeploys via Render).

---

## Table of contents
1. [Try the live demo (no install needed)](#try-the-live-demo-no-install-needed)
2. [Login / demo accounts](#login--demo-accounts)
3. [What it does — feature tour](#what-it-does--feature-tour)
4. [Role guide — what each role can do](#role-guide--what-each-role-can-do)
5. [App routes / screens](#app-routes--screens)
6. [Tech stack](#tech-stack)
7. [Real API integration](#real-api-integration)
8. [Privacy, security & audit](#privacy-security--audit)
9. [Run locally (developer setup)](#run-locally-developer-setup)
10. [Environment variables](#environment-variables)
11. [Testing](#testing)

---

## Try the live demo (no install needed)

> **Important:** AnimalGuard is **already deployed** — you do **not** need to run anything locally to try it.
>
> Open **https://animalguard.onrender.com/** in any modern browser (Chrome recommended for voice features). It is a fully seeded live demo with 4 demo roles, real satellite/weather integrations (when `AGRO_API_KEY` is set) and a JSON-file data store.

## Login / demo accounts

The app has **no traditional username/password login page**. The landing screen is a **role-selection card** — clicking a role instantly signs you in as that role's pre-seeded demo user (server-side auth is untouched; this is pure demo convenience).

| Role | Demo mobile no. | Login code | What you get |
|------|-----------------|------------|--------------|
| **Livestock Owner** (farmer) | `9876543210` | `0000` | Own dashboard, farms, reporting, alerts, records |
| **Veterinary** (Pune, Haveli) | `9123456780` | `0000` | District outbreak dashboard, cases, map, samples |
| **Admin** | `9988776655` | `0000` | Aggregated surveillance, audit log, critical-case access |
| **Lab Analyst** | `9000000001` | `0000` | Referred-sample inbox and result entry |

These mobile numbers are useful for demos/docs/tests — the UI itself logs you in with one tap and never asks you to type a number.

## What it does — feature tour

- **Live environmental sensing** — real NDVI/NDWI/DSWI satellite vegetation-stress, soil moisture/temperature and weather per farm from the **Agro Monitoring API** & **OpenWeather** (server-side proxy, keys never reach the browser).
- **Autonomous sensing → auto-alerts** — when sensor envelopes cross a risk threshold the system **auto-files a report without any farmer typing**; every alert is traceable to the exact raw sensing reading that triggered it.
- **AI disease prediction & FDRS** — scores ~15 livestock/poultry diseases (FMD, heat-stress, HPAI, LSD, HS, bluetongue, coccidiosis, …) from sensor + report + historical data. Each farm gets a **FDRS risk score out of 100** built from **4 transparent components**:
  - Reported Cases (35)
  - Historical Risk (20)
  - Environmental Risk (25)
  - Nearby Outbreak (20)
- **ZOONOTIC warnings** — diseases that can spread to humans (e.g. Anthrax) show a red badge with a clear human-health advisory (gloves/masks, no raw milk, isolate, inform the primary health centre).
- **Farmer reporting, 3 ways** — report symptoms by **typed checklist**, **photo**, or **hands-free voice** (browser speech in हिंदी — no-typist friendly). Each report is **AI-screened** (PENDING → SCREENED with confidence).
- **Outbreak intelligence** — spatio-temporal clustering (radius + time window) into **Emerging / CRITICAL** zones, risk rings, FDRS per farm, and an interactive Leaflet map.
- **Vet response workflow** — **Dispatch Vet** / **Send Advisory** campaigns from a cluster; advisories reach the farmer's inbox **in the farmer's own language**; every action lands in the audit chain.
- **Lab closed loop** — vet refers samples (Blood/Swab/Feces/Milk/Tissue) → lab returns Positive/Negative → result is written back onto the farm's health record.
- **Herd health records** — vaccinations, vaccination drives, treatments, deworming and mortality per farm.
- **Full multi-language UI** — English / हिन्दी / मराठी switchable live from the header; farm names and village/taluka/district names are also translated.
- **Tamper-evident append-only audit chain** — every dispatch, advisory and gated access is hashed and chained; verification detects tampering.
- **Privacy by architecture** — GPS/PII stays server-side; each role can only see exactly what it is authorised to see.

## Role guide — what each role can do

| Role | See / do | Route (after login) |
|------|----------|---------------------|
| **Livestock Owner** | Dashboard (stats), register farms, report symptoms, view reports + AI screening, live sensing per farm, FDRS + disease risk, health records, alerts, lab results for own farms | `/owner`, `/my-farm`, `/report`, `/my-reports`, `/health-records`, `/my-alerts`, `/my-lab`, `/farm/:farmId` |
| **Veterinary** | District outbreak dashboard, case list, outbreak map, farm registry view, sample management, herd health across farms, escalations, impact metrics | `/vet`, `/vet/cases`, `/vet/map`, `/vet/farms`, `/vet/samples`, `/vet/health`, `/vet/escalations`, `/vet/impact` |
| **Admin** | Aggregated de-identified surveillance, tamper-evident audit log, district escalation console, gated **Critical Case Access** (minimum-needed PII release) | `/admin`, `/admin/audit`, `/admin/escalations`, `/admin/critical` |
| **Lab Analyst** | Referred-sample inbox, result entry, completed results, sample history | `/lab`, `/lab/inbox`, `/lab/results`, `/lab/history` |

Use the **"Switch Role"** button in the sidebar to change demo roles instantly.

## App routes / screens

- `/` — role-selection landing (one-tap demo login)
- `/architecture` — system architecture explainer
- `/walkthrough` — guided auto-demo that drives the full pipeline end to end
- Farmer: `/owner`, `/my-farm`, `/register-farm`, `/report`, `/my-reports`, `/health-records`, `/my-alerts`, `/my-lab`, `/profile`, `/farm/:farmId`
- Vet: `/vet`, `/vet/cases`, `/vet/map`, `/vet/farms`, `/vet/samples`, `/vet/health`, `/vet/escalations`, `/vet/impact`
- Admin: `/admin`, `/admin/audit`, `/admin/escalations`, `/admin/critical`
- Lab: `/lab`, `/lab/inbox`, `/lab/results`, `/lab/history`

## Tech stack

- **Frontend:** React 19 + Vite, Tailwind CSS 4, React Leaflet, Web Speech API
- **Backend:** Node.js + Express 5, JWT auth, Multer (photo upload), express-rate-limit
- **Data:** JSON-file data store (zero-DB demo) — *prototype persistence disclaimer*
- **Hosting:** Render (repo `main` → auto-deploy), Node `>=20.19`
- **Testing:** oxlint, `server/unit.test.js` (31 checks), `server/smoke.js` (end-to-end check script, prints pass/fail counts)

## Real API integration

- **Agro Monitoring API** (`AGRO_API_KEY`) — polygon registration, satellite stats (NDVI/NDWI/DSWI), soil data, weather/rainfall via OpenWeather (same key). Proxied server-side through `/api/*`.
- **OpenAI Vision** (`VISION_API_KEY`, optional) — photo reports are AI-analyzed server-side (default `gpt-4o-mini`).
- All third-party calls run **server-side** (`server/index.js`) so keys never reach the browser. Note: Agro's `weather/history` endpoint is plan-gated (401) → 7-day rainfall honestly returns `null`.
- Without any keys the app still works fully on seeded data — environmental predictions just show "no live signal".

## Privacy, security & audit

- **PII stays server-side** — the browser never receives GPS coordinates; farm-level identified data is only released for critical cases under a gated, logged flow.
- **Role-based access control** — farmer sees only own farms; admin sees only aggregated/de-identified data; lab sees only referred samples.
- **Tamper-evident audit chain** — append-only, hash-linked entries; `verify` check detects any modification.
- **Rate limiting** on auth endpoints; server never logs secrets.

## Run locally (developer setup)

> Most users should just use the **deployed demo** above. Only run locally when you want to modify code.

Prerequisites: **Node.js ≥ 20.19**.

```bash
git clone <your-repo-url>
cd Animal-Gaurd
npm install

# 1) Optional: real satellite/weather API key (32-char key from app.agrocares.com)
#    Without it the app runs fully on seeded data; sensing shows "no live signal".
echo "AGRO_API_KEY=your_32_char_key" > server/.env
# (optionally add JWT_SECRET=<random> to server/.env for local JWT signing)

# 2) Start the backend on :4000 (the Vite proxy targets it)
npm run server

# 3) In a second terminal, start the frontend
npm run dev
```

Open the printed **http://localhost:5173** URL in your browser and click a role card.

> **Production build:** `npm run build` then `npm run preview` serves the built app; `npm run server` serves it in production mode (Render uses this).

## Environment variables

| Variable | Where | Required? | Purpose |
|----------|-------|-----------|---------|
| `AGRO_API_KEY` | `server/.env` (local) / Render env | No | Real satellite/soil/weather sensing (server proxy) |
| `VISION_API_KEY` | `server/.env` (local) / Render env | No | Optional OpenAI key for photo-report analysis |
| `JWT_SECRET` | `server/.env` (local) / Render env | Recommended | Signs auth tokens; falls back to a dev-only string when absent |

Never commit `.env` or `server/.env` — both are in `.gitignore`.

## Testing

```bash
npm run check     # esbuild bundle sanity check
npm run build     # production build
node --test server/unit.test.js   # 31 unit checks
node server/smoke.js              # 27 end-to-end checks
```

---
Built for **Smart India Hackathon 2026** · Problem statement **SIH26128** · Government of Maharashtra