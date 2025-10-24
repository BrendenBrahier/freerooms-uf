#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const dataDir = path.join(backendRoot, "data");
const campusBoundariesPath = path.join(dataDir, "campus-boundaries.json");

dotenv.config({ path: path.join(backendRoot, ".env") });

const rl = readline.createInterface({ input, output });

const { values } = parseArgs({
  options: {
    term: { type: "string", default: "Fall 2025" },
    size: { type: "string" },
    sizes: { type: "string" }, // comma-separated list
    buildings: { type: "string" }, // comma-separated list of building IDs
    output: {
      type: "string",
      default: path.join(dataDir, "stars-open-rooms.json"),
    },
    headless: { type: "boolean", default: false },
  },
});

const classSizes = ((): string[] => {
  if (values.sizes) {
    return values.sizes
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }
  if (values.size) return [values.size.trim()];
  // Default to a few useful buckets
  return ["10", "25", "50"];
})();

const requestedBuildingIds = values.buildings
  ? values.buildings.split(",").map((token) => token.trim())
  : null;

const term = values.term ?? "Fall 2025";

interface BoundaryFeature {
  properties?: {
    PropName?: string;
    PropCID?: string;
    PropSTCode?: string;
    Latitude?: number;
    Longitude?: number;
    ABRV?: string;
  };
}

interface BuildingMeta {
  id: string;
  name: string;
  campusId: string | null;
  code: string | null;
  lat: number | null;
  lng: number | null;
  raw?: {
    boundaries?: BoundaryFeature;
    stars?: Record<string, unknown> | null;
  };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadBoundaryMetadata(): Map<string, BuildingMeta> {
  if (!fs.existsSync(campusBoundariesPath)) {
    console.warn(
      `Warning: ${campusBoundariesPath} not found. Run the download step for campus boundaries.`
    );
    return new Map();
  }

  const raw = fs.readFileSync(campusBoundariesPath, "utf8");
  let parsed: { features?: BoundaryFeature[] };
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse campus-boundaries.json:", error);
    return new Map();
  }

  const map = new Map<string, BuildingMeta>();
  for (const feature of parsed.features ?? []) {
    const props = feature?.properties;
    const id = props?.PropSTCode?.trim();
    if (!id) continue;

    if (!map.has(id)) {
      map.set(id, {
        id,
        name: props?.PropName ?? id,
        campusId: props?.PropCID ?? null,
        code: props?.ABRV ?? null,
        lat: typeof props?.Latitude === "number" ? props?.Latitude : null,
        lng: typeof props?.Longitude === "number" ? props?.Longitude : null,
        raw: { boundaries: feature },
      });
    }
  }

  return map;
}

function sanitizeBuildingId(building: any): string | null {
  return (
    building?.buildingId ??
    building?.BUILDINGID ??
    building?.BUILDING_ID ??
    building?.building_id ??
    building?.buildingCode ??
    building?.code ??
    building?.id ??
    null
  );
}

function sanitizeBuildingName(building: any): string {
  return (
    building?.buildingName ??
    building?.BUILDINGNAME ??
    building?.name ??
    building?.label ??
    ""
  );
}

function sanitizeBuildingCode(building: any): string | null {
  return (
    building?.buildingCode ??
    building?.BUILDINGCODE ??
    building?.code ??
    building?.shortName ??
    null
  );
}

async function main() {
  const boundaryMetadata = loadBoundaryMetadata();

  const captured: {
    terms: any | null;
    buildings: any[] | null;
    classTermsUrl?: string;
    buildingsUrl?: string;
  } = {
    terms: null,
    buildings: null,
  };

  console.log("Launching Chromium via Playwright...");
  const browser = await chromium.launch({ headless: values.headless === true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("response", async (response) => {
    const url = response.url();
    if (!url.startsWith("https://stars.facilities.ufl.edu/class/api/")) return;
    try {
      if (url.includes("/classTerms")) {
        captured.terms = await response.json();
        captured.classTermsUrl = url;
        console.log(`Captured class terms from ${url}`);
      } else if (url.includes("/buildings")) {
        const data = await response.json();
        if (Array.isArray(data)) {
          captured.buildings = data;
          captured.buildingsUrl = url;
          console.log(`Captured building list from ${url}`);
        }
      }
    } catch {
      /* ignore */
    }
  });

  console.log("Opening STARS login page...");
  await page.goto("https://stars.facilities.ufl.edu/class/", {
    waitUntil: "domcontentloaded",
  });

  console.log(
    "\nA Chromium window has opened. Sign in with your GatorLink credentials and complete Duo (or any MFA option).\n" +
      "Once the Open Rooms interface finishes loading, return to this terminal."
  );

  // Attempt to autofill credentials if provided and selectors are available.
  const username = process.env.UF_USERNAME;
  const password = process.env.UF_PASSWORD;
  if (username && password) {
    try {
      await page.waitForSelector('input[id="username"], input[name="username"]', {
        timeout: 10000,
      });
      await page.fill('input[id="username"], input[name="username"]', username);
      await page.fill('input[id="password"], input[name="password"]', password);
      const submitSelector =
        'button[type="submit"], input[type="submit"], button[name="_eventId_proceed"]';
      const submitButton = await page.$(submitSelector);
      if (submitButton) {
        await submitButton.click();
      } else {
        console.warn(
          "Auto-fill located the credentials fields but could not find a submit button. Complete the login manually."
        );
      }
    } catch (err) {
      console.warn(
        "Auto-fill for UF credentials was not successful. Complete the login manually."
      );
    }
  }

  try {
    await page.waitForURL("**/class/#/**", { timeout: 10 * 60 * 1000 });
  } catch (err) {
    console.error(
      "Timed out waiting for the STARS dashboard. Close the Chromium window and retry."
    );
    await browser.close();
    process.exit(1);
  }

  console.log("Detected STARS dashboard. Capturing authenticated session...");
  const cookies = await context.cookies();
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const userAgent = await page.evaluate(() => navigator.userAgent);

  const defaultHeaders = {
    Cookie: cookieHeader,
    Accept: "application/json, text/plain, */*",
    Referer: "https://stars.facilities.ufl.edu/class/",
    "User-Agent": userAgent,
  };

  console.log(
    "\nInteract with the STARS page now (change term, open the Building dropdown, etc.) so we can capture the building list."
  );
  await rl.question("Press Enter here once the filters have finished loading...");

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { headers: defaultHeaders });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText}\n${text}`);
    }
    return response.json() as Promise<T>;
  }

  const apiBase = "https://stars.facilities.ufl.edu/class/api";

  console.log("Fetching available terms...");
  let terms: any = captured.terms;
  if (!terms) {
    terms = await fetchJson(`${apiBase}/classTerms`);
  }

  const termSegment = encodeURIComponent(term);

  console.log(`Fetching buildings for term "${term}"...`);
  type BuildingRecord = Record<string, unknown>;
  let buildings: BuildingRecord[] | null = null;

  if (captured.buildings) {
    buildings = captured.buildings as BuildingRecord[];
  } else {
    try {
      buildings = await fetchJson(`${apiBase}/buildings/${termSegment}`);
    } catch (err) {
      console.warn(
        "Could not load building list automatically. If nothing appears in the browser, open the Building dropdown manually, then rerun the script or provide --buildings with specific IDs.",
        err
      );
    }
  }

  if (!buildings) {
    if (requestedBuildingIds) {
      buildings = requestedBuildingIds.map((id) => ({ buildingId: id, buildingName: id }));
    } else {
      console.warn(
        "STARS building list not available; falling back to campus boundaries metadata."
      );
      buildings = Array.from(boundaryMetadata.values()).map((meta) => ({
        buildingId: meta.id,
        buildingName: meta.name,
      }));
    }
  }

  const normalizedBuildings = buildings
    .map((building) => {
      const id = sanitizeBuildingId(building);
      if (!id) return null;
      const meta = boundaryMetadata.get(id) ?? null;
      return {
        id,
        name: meta?.name ?? sanitizeBuildingName(building),
        code: meta?.code ?? sanitizeBuildingCode(building),
        campusId: meta?.campusId ?? null,
        lat: meta?.lat ?? null,
        lng: meta?.lng ?? null,
        raw: {
          stars: building,
          boundaries: meta?.raw?.boundaries ?? null,
        },
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const selectedBuildings = requestedBuildingIds
    ? normalizedBuildings.filter((building) =>
        requestedBuildingIds.includes(building.id)
      )
    : normalizedBuildings;

  if (selectedBuildings.length === 0) {
    console.error("No buildings matched the supplied filters.");
    await browser.close();
    process.exit(1);
  }

  console.log(
    `Will fetch availability for ${selectedBuildings.length} building(s) ` +
      `across class sizes [${classSizes.join(", ")}].`
  );

  const buildingsWithRooms: Array<{
    id: string;
    name: string;
    code: string | null;
    campusId: string | null;
    lat: number | null;
    lng: number | null;
    sizes: Record<string, unknown[]>;
  }> = [];

  let buildingIndex = 0;
  for (const building of selectedBuildings) {
    buildingIndex += 1;
    console.log(
      `Fetching building ${buildingIndex}/${selectedBuildings.length}: ${building.name || building.id}`
    );
    const perSize: Record<string, unknown[]> = {};
    for (const size of classSizes) {
      const sizeSegment = encodeURIComponent(size);
      const url = `${apiBase}/openRooms/${termSegment}/${encodeURIComponent(
        building.id
      )}/${sizeSegment}`;
      console.log(`  - class size ${size}: ${url}`);
      try {
        const result = await fetchJson(url);
        if (Array.isArray(result)) {
          perSize[size] = result;
        } else if (result && typeof result === "object" && Array.isArray((result as any).rooms)) {
          perSize[size] = (result as any).rooms;
        } else {
          perSize[size] = [];
        }
      } catch (err) {
        console.warn(`    ! Failed to fetch size ${size} for ${building.id}: ${err}`);
        perSize[size] = [];
      }
    }
    const hasAvailability = Object.values(perSize).some(
      (value) => Array.isArray(value) && value.length > 0
    );

    if (!hasAvailability) {
      console.log(`    ! No availability returned for ${building.id}, skipping`);
      continue;
    }

    buildingsWithRooms.push({
      id: building.id,
      name: building.name,
      code: building.code ?? null,
      campusId: building.campusId ?? null,
      lat: building.lat ?? null,
      lng: building.lng ?? null,
      sizes: perSize,
    });
  }

  ensureDir(dataDir);
  const outputPath = path.resolve(values.output);
  const payload = {
    fetchedAt: new Date().toISOString(),
    term,
    classSizes,
    buildings: buildingsWithRooms,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved dataset to ${outputPath}`);

  console.log("Closing Chromium browser...");
  await browser.close();
  rl.close();
}

main().catch((error) => {
  console.error("Failed to fetch STARS data:", error);
  rl.close();
  process.exit(1);
});
