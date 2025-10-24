#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  buildAvailabilityDataset,
  type AvailabilityDataset,
  type RawStarsData,
  type RawClassroomDataset,
} from "../lib/availability.js";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const DATA_DIR = path.join(process.cwd(), "data");
const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");
const STARS_FILE = path.join(SNAPSHOT_DIR, "stars-open-rooms.json");
const CLASSROOMS_FILE = path.join(SNAPSHOT_DIR, "classrooms.json");

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

async function publish() {
  console.log("Reading local cache...");
  const stars = readJson<RawStarsData>(STARS_FILE);
  const classrooms = readJson<RawClassroomDataset>(CLASSROOMS_FILE);

  console.log("Building availability dataset...");
  const dataset: AvailabilityDataset = buildAvailabilityDataset(
    stars,
    classrooms
  );

  console.log("Uploading snapshot to Supabase...");
  const { error } = await supabase.from("room_availability_snapshots").upsert(
    {
      term: dataset.term || stars.term,
      fetched_at: dataset.fetchedAt,
      data: dataset,
    },
    { onConflict: "term" }
  );

  if (error) {
    console.error("Supabase upsert failed:", error);
    process.exit(1);
  }

  console.log(
    `Published availability snapshot for term "${dataset.term}" (fetched ${dataset.fetchedAt}).`
  );
}

publish().catch((error) => {
  console.error("Failed to publish availability dataset:", error);
  process.exit(1);
});
