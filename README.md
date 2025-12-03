# FreeRooms@UF - Minimal Working Starter

Minimal full-stack starter:

- Backend: Express API serving live room availability + metadata.
- Frontend: Vite + React app with list and map views (Leaflet).

## Quickstart

### Option A - one-time setup and single-command start

From the repository root (this folder):

```bash
node setup.js   # installs backend + frontend dependencies
node start.js   # starts both servers together
```

The backend runs on `http://localhost:4000` and the frontend on `http://localhost:5173`. Press `Ctrl+C` once to stop both.

### Option B - manual workflow

#### Backend

```bash
cd backend
npm install
npm run dev
# Visit: http://localhost:4000/api/rooms/open
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
# Visit: http://localhost:5173
```

The frontend dev server proxies `/api/*` to `http://localhost:4000`.

## Optional: pull live STARS availability

You can capture a fresh dataset from STARS and cache it locally for development.

1. Add your GatorLink credentials to `backend/.env` (or leave them blank and log in manually)
   ```
   UF_USERNAME=yourGatorlink
   UF_PASSWORD=yourPassword   # optional – the script can prompt you to log in manually
   ```
2. Install backend tooling and Playwright assets once:
   ```bash
   cd backend
   npm install
   npx playwright install chromium
   ```
3. Run the fetcher (opens a Chromium window so you can complete Duo/MFA):
   ```bash
   npx tsx scripts/fetch-stars.ts --term "Fall 2025" --sizes 10,25,50
   ```

````
   The script saves the authenticated responses to `backend/data/stars-open-rooms.json` and logs each building/size combination it captured.

These snapshots live under `backend/data/snapshots/` (they are ignored by git). The backend will prefer the Supabase copy when it exists, falling back to these local files only if needed.

## Optional: capture classroom metadata (photos + amenities)
The UF IT site publishes room photos and equipment lists. You can snapshot that content into `backend/data/classrooms.json` for the API to consume.

```bash
cd backend
npx tsx scripts/scrape-classrooms.ts
````

The scraper uses Playwright to crawl `https://it.ufl.edu/classrooms/browse-classrooms/`, then writes a JSON file containing building/room identifiers, seating capacity, amenity flags, and image URLs. Re-run it whenever UF updates the listings.

## Publishing the merged dataset to Supabase

The server reads the merged availability dataset directly from Supabase so other developers don't need to regenerate the JSON locally.

1. Create the table in Supabase (SQL editor):
   ```sql
   create table if not exists room_availability_snapshots (
     term text primary key,
     fetched_at timestamptz not null,
     data jsonb not null,
     created_at timestamptz default timezone('utc', now())
   );
   ```
2. Generate fresh caches (`stars-open-rooms.json`, `classrooms.json`) with the scripts above.
3. Publish the snapshot (runs fetch → scrape → publish in one step):
   ```bash
   cd backend
   npm run refresh:data
   ```

After this command finishes, the latest dataset is stored in Supabase (table `room_availability_snapshots`). The backend automatically tries to load the newest snapshot at startup and falls back to the local JSON files under `data/snapshots/` only if Supabase is unavailable.

## API Endpoints

All routes are served from the backend (`http://localhost:4000` in dev).

- `GET /api/rooms/open`
  Query params (optional):
  - `size`: minimum capacity bucket (e.g., `10`, `25`)
  - `buildingId`: STARS building ID (e.g., `B800000007`)
  - `buildingCode`: campus code (e.g., `AND`)
  - `room`: room number (e.g., `0013`)
    Response includes:
  - `periodStartTimes`: mapping of STARS periods to 12‑hour start times
  - `buildings[]` → `rooms[]` → `availability` keyed by size
  - Each size entry contains:
    - `periods[]` with `day`, `period`, `startTime`, `endTime` (12‑hour strings)
    - `isAvailableNow` (boolean) based on current Eastern time
    - `nextAvailable` (next day/period/time if the room is currently unavailable)
- `GET /api/rooms/:id` (e.g., `/api/rooms/AND-0013`)  
  Returns the single building/room record with the same structure as above.
- `GET /api/buildings`  
  Returns basic building metadata and room counts (no availability payload).

All availability calculations are done in real time using Eastern Time, so `isAvailableNow` reflects the moment the request is processed.

## Next Steps

- Compute `open_until` from (next class start) and (building close) with a buffer.

## Tech Stack

### Backend

- [Express](https://expressjs.com/) - minimal web framework for Node.js
- [dotenv](https://github.com/motdotla/dotenv) - loads environment variables from `.env`
- [cors](https://github.com/expressjs/cors) - cross-origin resource sharing
- [morgan](https://github.com/expressjs/morgan) - HTTP request logging middleware
- [zod](https://zod.dev/) - schema validation
- [@supabase/supabase-js](https://supabase.com/docs/reference/javascript/introduction) - Supabase client library (future use)

### Frontend

- [React](https://react.dev/) - component-based UI library
- [Vite](https://vitejs.dev/) - fast dev server and build tool
- [React Leaflet](https://react-leaflet.js.org/) - React bindings for Leaflet maps
- [Leaflet](https://leafletjs.com/) - interactive map library
- [React Router](https://reactrouter.com/) - client-side routing (prepared for future use)
