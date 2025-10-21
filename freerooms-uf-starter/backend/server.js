import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js'

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn("Supabase credentials missing; continuing with mock data only.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT = process.env.PORT || 4000;

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "dev" });
});

// Load mock rooms
function loadRooms() {
  const file = path.join(__dirname, "mock", "rooms.json");
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

// Derived computation: open_until already computed in mock, but here we could compute it
app.get("/api/rooms/open", (req, res) => {
  const now = new Date();
  const rooms = loadRooms();
  // naive filtering for demo purposes
  const openRooms = rooms.filter(r => r.is_open);
  // sort by 'closes_in_minutes' ascending, then by capacity desc
  openRooms.sort((a,b) => (a.closes_in_minutes - b.closes_in_minutes) || (b.capacity - a.capacity));
  res.json({ as_of: now.toISOString(), rooms: openRooms });
});

// Single room details
app.get("/api/rooms/:id", (req, res) => {
  const rooms = loadRooms();
  const room = rooms.find(r => r.room_id.toLowerCase() === req.params.id.toLowerCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room);
});

// In a real app, this would proxy STARS or a cache; for now, serves mock building list
app.get("/api/buildings", (req, res) => {
  const rooms = loadRooms();
  const buildingsMap = new Map();
  rooms.forEach(r => {
    buildingsMap.set(r.building_id, {
      building_id: r.building_id,
      name: r.building_name,
      lat: r.lat,
      lng: r.lng
    });
  });
  res.json({ buildings: Array.from(buildingsMap.values()) });
});

app.listen(PORT, () => {
  console.log(`FreeRooms backend listening on http://localhost:${PORT}`);
});
