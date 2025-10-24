export interface PeriodEntry {
  day: string;
  period: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
}

export interface NextAvailability {
  day: string;
  dayLabel: string;
  period: string;
  startTime: string;
  endTime: string;
}

export interface SizeAvailability {
  periods: PeriodEntry[];
  isAvailableNow?: boolean;
  nextAvailable?: NextAvailability | null;
}

interface RoomMetadata {
  capacity: number | null;
  photo: string | null;
  gallery: string[];
  features: Array<{ slug: string; label: string }>;
  featureFlags: Record<string, boolean>;
  detailUrl: string;
}

export interface RoomAvailability {
  number: string;
  metadata?: RoomMetadata;
  availability: Record<string, SizeAvailability>;
}

export interface BuildingAvailability {
  id: string;
  code: string | null;
  name: string;
  campusId: string | null;
  lat: number | null;
  lng: number | null;
  rooms: RoomAvailability[];
}

export interface AvailabilityDataset {
  fetchedAt: string;
  term: string;
  classSizes: string[];
  buildings: BuildingAvailability[];
}

export interface RawStarsEntry {
  ROOM: string;
  DAY: string;
  PERIOD: string;
}

export interface RawStarsBuilding {
  id: string;
  name: string;
  code?: string | null;
  campusId?: string | null;
  lat?: number | null;
  lng?: number | null;
  sizes: Record<string, RawStarsEntry[]>;
}

export interface RawStarsData {
  fetchedAt: string;
  term: string;
  classSizes: string[];
  buildings: RawStarsBuilding[];
}

export interface RawClassroomFeature {
  slug: string;
  label: string;
}

export interface RawClassroomRecord {
  buildingCode: string;
  roomNumber: string;
  name: string;
  displayName: string;
  capacity: number | null;
  photo: string | null;
  gallery: string[];
  features: RawClassroomFeature[];
  featureFlags: Record<string, boolean>;
  detailUrl: string;
}

export interface RawClassroomDataset {
  fetchedAt: string;
  source: string;
  rooms: RawClassroomRecord[];
}

interface TimeContext {
  dayCode: string;
  minutes: number;
}

interface StatusResult {
  isAvailableNow: boolean;
  nextAvailable: NextAvailability | null;
}

const PERIOD_DEFINITIONS: Record<string, { start: string; end: string }> = {
  "1": { start: "07:25", end: "08:15" },
  "2": { start: "08:30", end: "09:20" },
  "3": { start: "09:35", end: "10:25" },
  "4": { start: "10:40", end: "11:30" },
  "5": { start: "11:45", end: "12:35" },
  "6": { start: "12:50", end: "13:40" },
  "7": { start: "13:55", end: "14:45" },
  "8": { start: "15:00", end: "15:50" },
  "9": { start: "16:05", end: "16:55" },
  "10": { start: "17:10", end: "18:00" },
  "11": { start: "18:15", end: "19:05" },
  E1: { start: "19:20", end: "20:10" },
  E2: { start: "20:20", end: "21:10" },
  E3: { start: "21:20", end: "22:10" },
};

export const PERIOD_START_TIMES: Record<string, string> = Object.fromEntries(
  Object.entries(PERIOD_DEFINITIONS).map(([period, def]) => [
    period,
    formatTime12(def.start),
  ])
);

const PERIOD_START_TIMES_24 = Object.fromEntries(
  Object.entries(PERIOD_DEFINITIONS).map(([period, def]) => [period, def.start])
);

const DAY_ORDER: Record<string, number> = {
  M: 0,
  T: 1,
  W: 2,
  TH: 3,
  F: 4,
  S: 5,
  SU: 6,
};

const DAY_SEQUENCE = ["M", "T", "W", "TH", "F", "S", "SU"];

const DAY_LABELS: Record<string, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  TH: "Thursday",
  F: "Friday",
  S: "Saturday",
  SU: "Sunday",
};

function formatTime12(hourMinute: string): string {
  const [hh, mm] = hourMinute.split(":").map(Number);
  const period = hh >= 12 ? "PM" : "AM";
  const hour = ((hh + 11) % 12) + 1;
  return `${hour}:${mm.toString().padStart(2, "0")} ${period}`;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map((value) => Number(value));
  return hours * 60 + minutes;
}

function sortPeriods(periods: string[]): string[] {
  return periods.sort((a, b) => {
    const aTime = PERIOD_START_TIMES_24[a];
    const bTime = PERIOD_START_TIMES_24[b];
    if (aTime && bTime) {
      return toMinutes(aTime) - toMinutes(bTime);
    }
    if (aTime) return -1;
    if (bTime) return 1;
    return a.localeCompare(b);
  });
}

function normalizePeriodEntries(entries: RawStarsEntry[]): PeriodEntry[] {
  const byDay = new Map<string, Set<string>>();

  entries.forEach((entry) => {
    const day = entry.DAY.toUpperCase();
    const period = entry.PERIOD.toUpperCase();
    if (!byDay.has(day)) {
      byDay.set(day, new Set());
    }
    byDay.get(day)!.add(period);
  });

  const days = Array.from(byDay.keys()).sort(
    (a, b) => (DAY_ORDER[a] ?? 99) - (DAY_ORDER[b] ?? 99)
  );

  const flattened: PeriodEntry[] = [];
  for (const day of days) {
    const periods = sortPeriods(Array.from(byDay.get(day)!));
    for (const period of periods) {
      const definition = PERIOD_DEFINITIONS[period] ?? {
        start: "00:00",
        end: "01:00",
      };
      flattened.push({
        day,
        period,
        startTime: formatTime12(definition.start),
        endTime: formatTime12(definition.end),
        startMinutes: toMinutes(definition.start),
        endMinutes: toMinutes(definition.end),
      });
    }
  }

  return flattened;
}

function weekdayToDayCode(weekday: string): string | null {
  const lower = weekday.toLowerCase();
  if (lower.startsWith("mon")) return "M";
  if (lower.startsWith("tue")) return "T";
  if (lower.startsWith("wed")) return "W";
  if (lower.startsWith("thu")) return "TH";
  if (lower.startsWith("fri")) return "F";
  if (lower.startsWith("sat")) return "S";
  if (lower.startsWith("sun")) return "SU";
  return null;
}

export function getCurrentEasternContext(): TimeContext | null {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;

  if (!weekday || !hour || !minute) return null;
  const dayCode = weekdayToDayCode(weekday);
  if (!dayCode) return null;

  const minutes = Number(hour) * 60 + Number(minute);
  return { dayCode, minutes };
}

function computeStatus(periods: PeriodEntry[], context: TimeContext): StatusResult {
  if (periods.length === 0) {
    return { isAvailableNow: false, nextAvailable: null };
  }

  let isAvailableNow = false;
  for (const period of periods) {
    if (
      period.day === context.dayCode &&
      period.startMinutes <= context.minutes &&
      context.minutes < period.endMinutes
    ) {
      isAvailableNow = true;
      break;
    }
  }

  const startIndex = DAY_SEQUENCE.indexOf(context.dayCode);
  let next: PeriodEntry | null = null;

  for (let offset = 0; offset < DAY_SEQUENCE.length; offset += 1) {
    const day = DAY_SEQUENCE[(startIndex + offset) % DAY_SEQUENCE.length];
    const dayPeriods = periods.filter((period) => period.day === day);

    if (offset === 0) {
      const upcoming = dayPeriods.find(
        (period) => period.startMinutes > context.minutes
      );
      if (upcoming) {
        next = upcoming;
        break;
      }
    } else if (dayPeriods.length > 0) {
      next = dayPeriods[0];
      break;
    }
  }

  const nextAvailable = next
    ? {
        day: next.day,
        dayLabel: DAY_LABELS[next.day] ?? next.day,
        period: next.period,
        startTime: next.startTime,
        endTime: next.endTime,
      }
    : null;

  return { isAvailableNow, nextAvailable };
}

export function applyRealtimeStatus(
  dataset: AvailabilityDataset
): AvailabilityDataset {
  const context = getCurrentEasternContext();
  if (!context) return dataset;

  dataset.buildings.forEach((building) => {
    building.rooms.forEach((room) => {
      Object.entries(room.availability).forEach(([size, record]) => {
        const status = computeStatus(record.periods, context);
        room.availability[size] = {
          periods: record.periods.map((period) => ({ ...period })),
          isAvailableNow: status.isAvailableNow,
          nextAvailable: status.nextAvailable,
        };
      });
    });
  });

  return dataset;
}

export function buildAvailabilityDataset(
  stars: RawStarsData | null,
  classrooms: RawClassroomDataset | null
): AvailabilityDataset {
  if (!stars) {
    return {
      fetchedAt: new Date().toISOString(),
      term: "",
      classSizes: [],
      buildings: [],
    };
  }

  const classroomMap = new Map<string, RawClassroomRecord>();
  if (classrooms?.rooms) {
    classrooms.rooms.forEach((room) => {
      const key = `${room.buildingCode.toUpperCase()}-${room.roomNumber.toUpperCase()}`;
      classroomMap.set(key, room);
    });
  }

  const buildingMap = new Map<
    string,
    BuildingAvailability & { roomsMap: Map<string, RoomAvailability> }
  >();

  for (const building of stars.buildings) {
    const buildingCode = building.code ? building.code.toUpperCase() : null;
    let buildingRecord = buildingMap.get(building.id);
    if (!buildingRecord) {
      buildingRecord = {
        id: building.id,
        code: buildingCode,
        name: building.name,
        campusId: building.campusId ?? null,
        lat: building.lat ?? null,
        lng: building.lng ?? null,
        rooms: [],
        roomsMap: new Map<string, RoomAvailability>(),
      };
      buildingMap.set(building.id, buildingRecord);
    }

    const sizeEntries = building.sizes ?? {};
    for (const [size, entries] of Object.entries(sizeEntries)) {
      const groupedByRoom = new Map<string, RawStarsEntry[]>();
      entries.forEach((entry) => {
        const roomNumber = entry.ROOM.padStart(4, "0");
        if (!groupedByRoom.has(roomNumber)) {
          groupedByRoom.set(roomNumber, []);
        }
        groupedByRoom.get(roomNumber)!.push(entry);
      });

      for (const [roomNumber, roomEntries] of groupedByRoom.entries()) {
        let roomRecord = buildingRecord.roomsMap.get(roomNumber);
        if (!roomRecord) {
          const metaKey =
            buildingRecord.code && roomNumber
              ? `${buildingRecord.code}-${roomNumber}`
              : null;
          const meta = metaKey ? classroomMap.get(metaKey) : undefined;
          roomRecord = {
            number: roomNumber,
            metadata: meta
              ? {
                  capacity: meta.capacity,
                  photo: meta.photo,
                  gallery: meta.gallery,
                  features: meta.features,
                  featureFlags: meta.featureFlags,
                  detailUrl: meta.detailUrl,
                }
              : undefined,
            availability: {},
          };
          buildingRecord.roomsMap.set(roomNumber, roomRecord);
        }

        const normalized = normalizePeriodEntries(roomEntries);
        if (normalized.length > 0) {
          roomRecord.availability[size] = { periods: normalized };
        }
      }
    }
  }

  const buildings: BuildingAvailability[] = Array.from(buildingMap.values()).map(
    (building) => ({
      id: building.id,
      code: building.code,
      name: building.name,
      campusId: building.campusId,
      lat: building.lat,
      lng: building.lng,
      rooms: Array.from(building.roomsMap.values()).sort((a, b) =>
        a.number.localeCompare(b.number)
      ),
    })
  );

  buildings.sort((a, b) => {
    if (a.code && b.code) {
      return a.code.localeCompare(b.code);
    }
    if (a.code) return -1;
    if (b.code) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    fetchedAt: stars.fetchedAt,
    term: stars.term,
    classSizes: stars.classSizes ?? [],
    buildings,
  };
}

function mapToPeriodEntry(raw: any): PeriodEntry {
  const day = (raw?.day ?? raw?.DAY ?? "").toUpperCase();
  const period = (raw?.period ?? raw?.PERIOD ?? "").toUpperCase();
  const definition = PERIOD_DEFINITIONS[period] ?? {
    start: "00:00",
    end: "01:00",
  };
  const startMinutes =
    typeof raw?.startMinutes === "number"
      ? raw.startMinutes
      : toMinutes(definition.start);
  const endMinutes =
    typeof raw?.endMinutes === "number"
      ? raw.endMinutes
      : toMinutes(definition.end);

  return {
    day,
    period,
    startTime: raw?.startTime ?? formatTime12(definition.start),
    endTime: raw?.endTime ?? formatTime12(definition.end),
    startMinutes,
    endMinutes,
  };
}

export function normalizeAvailabilityDataset(
  dataset: AvailabilityDataset
): AvailabilityDataset {
  dataset.buildings.forEach((building) => {
    building.rooms.forEach((room) => {
      const normalized: Record<string, SizeAvailability> = {};
      Object.entries(room.availability).forEach(([size, record]) => {
        if (Array.isArray(record)) {
          normalized[size] = { periods: record.map(mapToPeriodEntry) };
        } else if (
          record &&
          typeof record === "object" &&
          Array.isArray((record as SizeAvailability).periods)
        ) {
          normalized[size] = {
            periods: (record as SizeAvailability).periods.map(mapToPeriodEntry),
          };
        } else {
          normalized[size] = { periods: [] };
        }
      });
      room.availability = normalized;
    });
  });
  return dataset;
}
