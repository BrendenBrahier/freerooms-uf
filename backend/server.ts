import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Define interfaces for type safety
interface Room {
  room_id: string;
  building_id: string;
  building_name: string;
  room_number: string;
  lat: number;
  lng: number;
  capacity: number;
  amenities: string[];
  as_of: string;
  is_open: boolean;
  open_until: string;
  reason: string;
  closes_in_minutes: number;
  source_system: string;
  last_refresh: string;
}

interface Building {
  building_id: string;
  name: string;
  lat: number;
  lng: number;
}

dotenv.config();

const supabaseUrl: string | undefined = process.env.SUPABASE_URL;
const supabaseKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn("Supabase credentials missing; continuing with mock data only.");
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT: string | number = process.env.PORT || 4000;

// Simple health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "dev" });
});

// Load mock rooms
function loadRooms(): Room[] {
  try {
    const file: string = path.join(__dirname, "mock", "rooms.json");
    const raw: string = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as Room[];
  } catch (error) {
    console.error("Failed to load mock room data", error);
    return [];
  }
}

// Derived computation: open_until already computed in mock, but here we could compute it
app.get("/api/rooms/open", (req: Request, res: Response) => {
  const now: Date = new Date();
  const rooms: Room[] = loadRooms();
  // naive filtering for demo purposes
  const openRooms = rooms.filter((room) => room.is_open);
  // sort by 'closes_in_minutes' ascending, then by capacity desc
  openRooms.sort((a, b) => (a.closes_in_minutes - b.closes_in_minutes) || (b.capacity - a.capacity));
  res.json({ as_of: now.toISOString(), rooms: openRooms });
});

// Single room details
app.get("/api/rooms/:id", (req: Request, res: Response) => {
  const rooms: Room[] = loadRooms();
  const room = rooms.find((candidate) => candidate.room_id.toLowerCase() === req.params.id.toLowerCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room);
});

// In a real app, this would proxy STARS or a cache; for now, serves mock building list
app.get("/api/buildings", (req: Request, res: Response) => {
  const rooms: Room[] = loadRooms();
  const buildingsMap: Map<string, Building> = new Map();
  rooms.forEach((room) => {
    buildingsMap.set(room.building_id, {
      building_id: room.building_id,
      name: room.building_name,
      lat: room.lat,
      lng: room.lng
    });
  });
  res.json({ buildings: Array.from(buildingsMap.values()) });
});

app.listen(PORT, () => {
  console.log(`FreeRooms backend listening on http://localhost:${PORT}`);
});
