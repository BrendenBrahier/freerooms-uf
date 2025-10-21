# FreeRooms@UF - Minimal Working Starter

Minimal full-stack starter:
- Backend: Express API serving mock room availability.
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

## Next Steps
- Replace mock data with a cache layer fed by STARS (scrape or API).
- Compute `open_until` from (next class start) and (building close) with a buffer.
- Add filters for amenities and planning mode.

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
