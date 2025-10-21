# FreeRooms@UF — Minimal Working Starter

This is a minimal full-stack starter that you can run locally **right now**:
- **Backend**: Express server with `/api/rooms/open` returning mock availability
- **Frontend**: Vite + React app with **List + Map** views (Leaflet)

## Quickstart

### Option A — one-time setup & single-command start
From the repository root (this folder):
```bash
node setup.js   # installs backend + frontend dependencies
node start.js   # starts both servers together
```
The backend runs on `http://localhost:4000` and the frontend on `http://localhost:5173`. Hit `Ctrl+C` once to stop both.

### Option B — manual workflow

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
- **[Express](https://expressjs.com/)** - Fast, minimalist web framework for Node.js
- **[dotenv](https://github.com/motdotla/dotenv)** - Loads environment variables from `.env` file
- **[cors](https://github.com/expressjs/cors)** - Enable Cross-Origin Resource Sharing
- **[morgan](https://github.com/expressjs/morgan)** - HTTP request logger middleware
- **[zod](https://zod.dev/)** - TypeScript-first schema validation
- **[@supabase/supabase-js](https://supabase.com/docs/reference/javascript/introduction)** - Client library for Supabase database (for future use)

### Frontend
- **[React](https://react.dev/)** - UI library for building component-based interfaces
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server with hot module replacement
- **[React Leaflet](https://react-leaflet.js.org/)** - React components for Leaflet maps
- **[Leaflet](https://leafletjs.com/)** - Open-source JavaScript library for interactive maps
- **[React Router](https://reactrouter.com/)** - Client-side routing (installed for future use)
