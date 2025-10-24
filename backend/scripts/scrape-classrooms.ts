#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";

const BASE_URL = "https://it.ufl.edu";
const LISTING_PATH = "/classrooms/browse-classrooms/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
const OUTPUT_FILE = path.resolve(path.join("data", "classrooms.json"));

interface ListingCard {
  title: string;
  detailPath: string;
  image: string | null;
}

interface Feature {
  slug: string;
  label: string;
}

interface ClassroomRecord {
  buildingCode: string;
  roomNumber: string;
  name: string;
  displayName: string;
  capacity: number | null;
  photo: string | null;
  gallery: string[];
  features: Feature[];
  featureFlags: Record<string, boolean>;
  detailUrl: string;
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith("http")) return relativeOrAbsolute;
  return `${BASE_URL}${relativeOrAbsolute}`;
}

async function fetchHtml(urlOrPath: string): Promise<string> {
  const url = buildUrl(urlOrPath);
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.text();
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseListing(html: string): ListingCard[] {
  const $ = load(html);
  const cards: ListingCard[] = [];

  $("a.filter-item-link").each((_, element) => {
    const link = $(element).attr("href") || "";
    const title = $(element).find(".filter-item-title").text().trim();
    const img = $(element).find("img").attr("src") || null;

    if (title && link) {
      cards.push({
        title,
        detailPath: link,
        image: img,
      });
    }
  });

  return cards;
}

function extractIdentifiers(text: string): { building: string; room: string } | null {
  const cleaned = text.trim();
  // Patterns like "AND 0013", "Anderson Hall 0013", "MAT-0102"
  const match = cleaned.match(/([A-Za-z]{2,4})[\s\-]+0*([0-9A-Za-z]+)/);
  if (!match) return null;
  const building = match[1].toUpperCase();
  const room = match[2].padStart(4, "0");
  return { building, room };
}

function parseDetail(
  html: string,
  fallbackImage: string | null
): {
  codeText: string;
  capacity: number | null;
  features: Feature[];
  featureFlags: Record<string, boolean>;
  gallery: string[];
} {
  const $ = load(html);
  const codeText = $(".content-box-copy h2").first().text().trim();

  const features = $(".content-box-copy p.classroom-feature")
    .map((_, el) => $(el).text().trim())
    .toArray()
    .filter(Boolean)
    .map((label) => ({ slug: slugify(label), label }));

  const featureFlags = Object.fromEntries(features.map((f) => [f.slug, true]));

  const capacityText = $(".content-box-copy .category-tag").text();
  const capacityMatch = capacityText.match(/(\d+)/);
  const capacity = capacityMatch ? Number(capacityMatch[1]) : null;

  const gallery = new Set<string>();
  if (fallbackImage) gallery.add(buildUrl(fallbackImage));

  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    if (/\/classrooms\/media\/atufledu\/classrooms\//.test(src)) {
      gallery.add(buildUrl(src));
    }
  });

  return {
    codeText,
    capacity,
    features,
    featureFlags,
    gallery: Array.from(gallery),
  };
}

async function main() {
  ensureDir(OUTPUT_FILE);

  console.log("Downloading classroom listing...");
  const listingHtml = await fetchHtml(LISTING_PATH);
  if (process.env.DEBUG_SCRAPE === "true") {
    console.log(listingHtml.slice(0, 1000));
  }
  const filterCount = (listingHtml.match(/filter-item/g) || []).length;
  if (process.env.DEBUG_SCRAPE === "true") {
    console.log(`filter-item occurrences in HTML: ${filterCount}`);
  }
  const cards = parseListing(listingHtml);
  console.log(`Found ${cards.length} rooms on listing page.`);

  const results: ClassroomRecord[] = [];

  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const detailUrl = buildUrl(card.detailPath);
    console.log(`[${i + 1}/${cards.length}] ${card.title} -> ${detailUrl}`);

    try {
      const detailHtml = await fetchHtml(card.detailPath);
      const detail = parseDetail(detailHtml, card.image);

      const identifiers =
        extractIdentifiers(detail.codeText) ||
        extractIdentifiers(card.title) ||
        null;

      if (!identifiers) {
        console.warn(`  ! Unable to parse building/room for "${card.title}"`);
        continue;
      }

      results.push({
        buildingCode: identifiers.building,
        roomNumber: identifiers.room,
        name: `${identifiers.building} ${identifiers.room}`,
        displayName: card.title,
        capacity: detail.capacity,
        photo: detail.gallery[0] ?? null,
        gallery: detail.gallery,
        features: detail.features,
        featureFlags: detail.featureFlags,
        detailUrl,
      });
    } catch (error) {
      console.warn(`  ! Failed to process ${detailUrl}:`, error);
    }
  }

  results.sort((a, b) => {
    if (a.buildingCode === b.buildingCode) {
      return a.roomNumber.localeCompare(b.roomNumber);
    }
    return a.buildingCode.localeCompare(b.buildingCode);
  });

  const payload = {
    fetchedAt: new Date().toISOString(),
    source: buildUrl(LISTING_PATH),
    rooms: results,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Saved ${results.length} classroom records to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("Failed to scrape classrooms:", error);
  process.exit(1);
});
