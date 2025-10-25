import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAvailabilityDataset,
  type AvailabilityDataset,
  type BuildingAvailability,
  type RoomAvailability,
  type SizeAvailability,
  type RawClassroomDataset,
  type RawStarsData,
  PERIOD_START_TIMES,
  applyRealtimeStatus,
  normalizeAvailabilityDataset,
} from "./lib/availability.js";

dotenv.config();

const supabaseUrl: string | undefined = process.env.SUPABASE_URL;
const supabaseKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE;
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.warn("Supabase credentials missing; continuing with cached data only.");
}

const __filename: string = fileURLToPath(import.meta.url);
const __dirname: string = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const PORT: string | number = process.env.PORT || 4000;

function resolvePath(rel: string): string {
  return path.join(__dirname, rel);
}

function readJsonFile<T>(relativePath: string): T | null {
  try {
    const filePath = resolvePath(relativePath);
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Unable to read ${relativePath}:`, error);
    return null;
  }
}

async function loadAvailabilityDataset(): Promise<AvailabilityDataset> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("room_availability_snapshots")
        .select("data, term, fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data?.data) {
        return normalizeAvailabilityDataset(
          data.data as AvailabilityDataset
        );
      }
      if (error) {
        console.warn("Supabase query failed; falling back to local cache:", error);
      }
    } catch (err) {
      console.warn("Supabase unavailable; falling back to local cache:", err);
    }
  }

  const stars = readJsonFile<RawStarsData>("data/stars-open-rooms.json");
  const classrooms = readJsonFile<RawClassroomDataset>("data/classrooms.json");
  const dataset = buildAvailabilityDataset(stars, classrooms);
  return normalizeAvailabilityDataset(dataset);
}

const AVAILABILITY_DATASET: AvailabilityDataset = await loadAvailabilityDataset();

function filterAvailability(
  dataset: AvailabilityDataset,
  filters: {
    size?: string | null;
    buildingId?: string | null;
    buildingCode?: string | null;
    roomNumber?: string | null;
  },
  periodFilters?: Set<string> | null
): AvailabilityDataset {
  const sizeFilter = filters.size?.toUpperCase() ?? null;
  const buildingIdFilter = filters.buildingId ?? null;
  const buildingCodeFilter = filters.buildingCode
    ? filters.buildingCode.toUpperCase()
    : null;
  const roomFilter = filters.roomNumber
    ? filters.roomNumber.toUpperCase()
    : null;

  const filteredBuildings: BuildingAvailability[] = dataset.buildings
    .filter((building: BuildingAvailability) => {
      if (buildingIdFilter && building.id !== buildingIdFilter) return false;
      if (
        buildingCodeFilter &&
        building.code?.toUpperCase() !== buildingCodeFilter
      ) {
        return false;
      }
      return true;
    })
    .map((building: BuildingAvailability) => {
      const rooms: RoomAvailability[] = [];

      building.rooms.forEach((room: RoomAvailability) => {
        if (roomFilter && room.number.toUpperCase() !== roomFilter) {
          return;
        }

        const sizeEntries = sizeFilter
          ? ([[sizeFilter, room.availability[sizeFilter]]] as Array<
              [string, SizeAvailability | undefined]
            >)
          : (Object.entries(room.availability) as Array<
              [string, SizeAvailability]
            >);

        const availability: Record<string, SizeAvailability> = {};

        sizeEntries.forEach(([sizeKey, record]) => {
          const cloned = cloneAvailabilityRecord(record, periodFilters);
          if (cloned) {
            availability[sizeKey] = cloned;
          }
        });

        if (Object.keys(availability).length === 0) {
          return;
        }

        rooms.push({
          number: room.number,
          metadata: room.metadata,
          availability,
        });
      });

      return {
        id: building.id,
        code: building.code,
        name: building.name,
        campusId: building.campusId,
        lat: building.lat,
        lng: building.lng,
        rooms,
      };
    })
    .filter((building) => building.rooms.length > 0);

  return {
    fetchedAt: dataset.fetchedAt,
    term: dataset.term,
    classSizes: dataset.classSizes,
    buildings: filteredBuildings,
  };
}

// ------------ Routes ------------

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, env: process.env.NODE_ENV || "dev" });
});

app.get("/api/rooms/open", (req: Request, res: Response) => {
  const { size, buildingId, buildingCode, room } = req.query;
  const periodFilters = parsePeriodFilters(req.query.periods);

  const dataset = filterAvailability(
    AVAILABILITY_DATASET,
    {
      size: size ? String(size) : null,
      buildingId: buildingId ? String(buildingId) : null,
      buildingCode: buildingCode ? String(buildingCode) : null,
      roomNumber: room ? String(room) : null,
    },
    periodFilters
  );

  const response = applyRealtimeStatus(dataset);
  if (!periodFilters) {
    stripPeriods(response);
  }

  res.json({
    fetchedAt: response.fetchedAt,
    term: response.term,
    classSizes: response.classSizes,
    buildings: response.buildings,
    periodStartTimes: PERIOD_START_TIMES,
  });
});

app.get("/api/rooms/:id", (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const match = id.match(/^([A-Z]{2,4})[-_]?([0-9A-Z]{1,4})$/);
  if (!match) {
    return res.status(400).json({ error: "Invalid room identifier format." });
  }
  const [, buildingCode, roomNumberRaw] = match;
  const roomNumber = roomNumberRaw.padStart(4, "0");

  const dataset = filterAvailability(
    AVAILABILITY_DATASET,
    {
      buildingCode,
      roomNumber,
    },
    null
  );
  applyRealtimeStatus(dataset);
  stripPeriods(dataset);

  const building = dataset.buildings[0];
  const room = building?.rooms[0];

  if (!building || !room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json({
    building,
    room,
    fetchedAt: dataset.fetchedAt,
    term: dataset.term,
    periodStartTimes: PERIOD_START_TIMES,
  });
});

app.get("/api/buildings", (_req: Request, res: Response) => {
  const buildings = AVAILABILITY_DATASET.buildings.map((building) => ({
    id: building.id,
    code: building.code,
    name: building.name,
    campusId: building.campusId,
    lat: building.lat,
    lng: building.lng,
    roomCount: building.rooms.length,
  }));

  res.json({
    fetchedAt: AVAILABILITY_DATASET.fetchedAt,
    term: AVAILABILITY_DATASET.term,
    buildings,
  });
});

app.listen(PORT, () => {
  console.log(`FreeRooms backend listening on http://localhost:${PORT}`);
});

function cloneAvailabilityRecord(
  record: SizeAvailability | undefined,
  periodFilters?: Set<string> | null
): SizeAvailability | null {
  if (!record) return null;
  const srcPeriods = record.periods ?? [];
  let periods = srcPeriods;
  if (periodFilters) {
    periods = srcPeriods.filter((entry) => periodFilters.has(entry.period));
    if (periods.length === 0) return null;
  }

  return {
    periods: periods.map((entry) => ({ ...entry })),
    isAvailableNow: record.isAvailableNow,
    nextAvailable: record.nextAvailable,
  };
}

function parsePeriodFilters(value: unknown): Set<string> | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value : String(value).split(",");
  const normalized = raw
    .map((item) => String(item).trim().toUpperCase())
    .filter(Boolean);
  return normalized.length ? new Set(normalized) : null;
}

function stripPeriods(dataset: AvailabilityDataset) {
  dataset.buildings.forEach((building) => {
    building.rooms.forEach((room) => {
      Object.values(room.availability).forEach((record) => {
        if (record.periods) {
          delete record.periods;
        }
      });
    });
  });
}
