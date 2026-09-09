# AnimalGuard — Livestock Disease Early Warning System (SIH26128)

A Smart India Hackathon 2.0 prototype for the Government of Maharashtra that detects and contains livestock disease outbreaks **before they spread** — combining **real satellite/soil/weather sensing** with **AI disease prediction**, **voice-native farmer reporting**, and a **veterinary response dashboard**.

---

## What it does
- **Live environmental sensing** — pulls real NDVI/NDWI/DSWI satellite vegetation-stress, soil moisture/temperature, and weather per farm from the **Agro API** (`AGRO_API_KEY`).
- **AI disease prediction** — scores ~15 livestock/poultry diseases (FMD, heat-stress, HPAI, LSD, coccidiosis…) from actual sensor envelopes; when a predicted risk crosses a threshold it **auto-files an alert**, traceable to the exact raw sensing reading that triggered it.
- **Farmer reporting** — report symptoms by **typing, photo, or voice** (Marathi/हिंदी/English, browser speech in *हिंदी* for listening). No-typist friendly.
- **Outbreak intelligence** — spatio-temporal clustering into **Emerging/CRITICAL** zones with 1km/5km risk rings, FDRS risk scores per farm, and an interactive map.
- **Response workflow** — vets/admin **Dispatch Vet / Send Advisory** from a cluster; farmers get advisories in their language; every action is recorded in a **tamper-evident append-only audit chain**.

## Problem it solves
Outbreaks are usually detected only after farmers manually report clinical cases — often too late, especially for remote/vocal-language communities. AnimalGuard closes that gap by flagging **pre-symptomatic risk from sensor data**, letting a single veterinary officer monitor an entire district and respond before animals die.

## Tech stack
- **Frontend:** React 19 + Vite, Tailwind CSS 4, React Leaflet, Web Speech API
- **Backend:** Node.js + Express 5, JWT, Multer
- **Data:** JSON-file data store (zero-DB demo), local-first belief *(disclaimer: prototype persistence)*
- **Testing:** oxlint, `server/unit.test.js` (31 checks), `server/smoke.js` (27 end-to-end checks)

## Real API integration
- **Agro API** (`AGRO_API_KEY`) — polygon registration, satellite stats (NDVI/NDWI/DSWI), soil data, current weather.
- All third-party calls run **server-side** (`server/index.js`) through `/api/*` proxies, so keys never reach the browser. Note: Agro's `weather/history` endpoint is plan-gated (401) → 7-day rainfall honestly returns `null`.

## Setup (2 minutes)
```bash
npm install
# 1) Create server/.env and add your Agro API key (32-char key from app.agrocares.com):
echo "AGRO_API_KEY=your_32_char_key" > server/.env
# 2) Run backend on :4000 (proxy target for the client)
npm run server
# 3) In a second terminal, run the frontend
npm run dev
```
Open the printed `http://localhost:5173` URL.

> **No Agro key?** The app still runs fully — farms get seeded data, and every feature (reporting, alerts, maps, audit) works; environmental predictions just show "no live signal" instead of real readings.

## Demo accounts (any 4-digit code works)
| Role | Mobile |
|------|--------|
| Farmer | `9876543210` |
| Vet (Pune) | `9123456780` |
| Admin | `9988776655` |

Poor/remote-village UX: tap **"No-Typing Voice Report"** for a hands-free guided report; swipe through **"Judge Walkthrough"** for prepared demo paths.