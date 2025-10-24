import { useMemo, useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import MapView from "./components/MapView";
import type {
  BuildingAvailability,
  DisplayRoom,
  NextAvailability,
  RoomAvailability,
  RoomsResponse,
  SizeAvailability,
} from "./types.ts";
import StudyContainer from "./StudyContainer";
import { filterRooms } from "./utils/roomFilters";
import logoUrl from "./assets/Logo.svg";
import { fetchStudyRooms } from "./api/studyRooms";
import ADAIcon from "./assets/ADA.svg";
import ChalkboardIcon from "./assets/Chalkboard.svg";
import PowerIcon from "./assets/Power.svg";
import ProjectorIcon from "./assets/Projector.svg";

const DEFAULT_STATE: RoomsResponse = {
  fetchedAt: "",
  term: "",
  classSizes: [],
  buildings: [],
};

const AMENITY_CANONICAL_MAP: Record<string, string> = {
  ada: "ada",
  accessibility: "ada",
  accessible: "ada",
  "ada-accessible": "ada",
  ada_accessible: "ada",
  wheelchair: "ada",
  chalkboard: "chalkboard",
  whiteboard: "chalkboard",
  "white-board": "chalkboard",
  dryerase: "chalkboard",
  "dry-erase": "chalkboard",
  dry_erase: "chalkboard",
  markerboard: "chalkboard",
  whiteboardmobile: "chalkboard",
  whiteboard_or_chalkboard: "chalkboard",
  power: "power",
  outlets: "power",
  "power-outlets": "power",
  power_outlets: "power",
  electric: "power",
  byod: "power",
  "byod-friendly": "power",
  charging: "power",
  student_byod_power: "power",
  projector: "projector",
  projectors: "projector",
  "projector-hd": "projector",
  "projector-dual": "projector",
  "projector-3": "projector",
  "projector-4": "projector",
  projector_hd: "projector",
  projector_dual: "projector",
  "rear-projector": "projector",
};

const AMENITY_DISPLAY_ORDER: string[] = [
  "ada",
  "chalkboard",
  "power",
  "projector",
];

const AMENITY_FILTER_OPTIONS: Array<{
  slug: string;
  label: string;
  icon: string;
}> = [
  { slug: "ada", label: "ADA Accessible", icon: ADAIcon },
  {
    slug: "chalkboard",
    label: "Whiteboard / Chalkboard",
    icon: ChalkboardIcon,
  },
  { slug: "power", label: "Student Power", icon: PowerIcon },
  { slug: "projector", label: "Projector", icon: ProjectorIcon },
];

function isSizeAvailable(entry?: SizeAvailability): boolean {
  return Boolean(entry?.isAvailableNow);
}

function pickNextAvailability(
  availability: Record<string, SizeAvailability>
): NextAvailability | null {
  const candidates = Object.values(availability)
    .map((record) => record.nextAvailable ?? null)
    .filter((value) => value !== null);
  return candidates.length > 0 ? candidates[0] : null;
}

function deriveCapacityFromSizes(sizeKeys: string[]): number | null {
  const numericSizes = sizeKeys
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (numericSizes.length === 0) {
    return null;
  }

  return Math.max(...numericSizes);
}

function extractAmenitySlugs(
  featureFlags: Record<string, boolean> | undefined
): string[] {
  if (!featureFlags) return [];

  const normalized = new Set<string>();
  Object.entries(featureFlags).forEach(([rawKey, isEnabled]) => {
    if (!isEnabled) return;
    const canonical = AMENITY_CANONICAL_MAP[rawKey.toLowerCase()];
    if (canonical) {
      normalized.add(canonical);
    }
  });

  return AMENITY_DISPLAY_ORDER.filter((slug) => normalized.has(slug));
}

function buildDisplayRooms(dataset: RoomsResponse): DisplayRoom[] {
  const { fetchedAt, buildings } = dataset;
  const rooms: DisplayRoom[] = [];

  buildings.forEach((building: BuildingAvailability) => {
    building.rooms.forEach((room: RoomAvailability) => {
      const sizeKeys = Object.keys(room.availability).sort((a, b) => {
        const aNum = Number(a);
        const bNum = Number(b);
        const aIsNumeric = Number.isFinite(aNum);
        const bIsNumeric = Number.isFinite(bNum);

        if (aIsNumeric && bIsNumeric) {
          return aNum - bNum;
        }

        if (aIsNumeric) return -1;
        if (bIsNumeric) return 1;
        return a.localeCompare(b);
      });
      const isAvailableNow = sizeKeys.some((key) =>
        isSizeAvailable(room.availability[key])
      );
      const nextAvailable = pickNextAvailability(room.availability);
      const amenities = extractAmenitySlugs(room.metadata?.featureFlags);
      const derivedCapacity =
        room.metadata?.capacity ?? deriveCapacityFromSizes(sizeKeys);

      rooms.push({
        id: `${building.code ?? building.id}-${room.number}`,
        buildingId: building.id,
        buildingName: building.name,
        buildingCode: building.code,
        roomNumber: room.number,
        lat: building.lat,
        lng: building.lng,
        capacity: derivedCapacity,
        amenities,
        sizeKeys,
        availability: room.availability,
        isAvailableNow,
        nextAvailable,
        fetchedAt,
        detailUrl: room.metadata?.detailUrl ?? null,
        photo: room.metadata?.photo ?? null,
      });
    });
  });

  return rooms;
}

const App = () => {
  const [data, setData] = useState<RoomsResponse>(DEFAULT_STATE);
  const [minCapacity, setMinCapacity] = useState<number>(1);
  const [query, setQuery] = useState<string>("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(true);
  const [periods, setPeriods] = useState<Array<number>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOpenRooms = async () => {
      try {
        setIsLoading(true);
        if (isMounted) {
          setError(null);
        }
        const payload = await fetchStudyRooms.rooms(
          periods.length ? { periods } : {}
        );
        if (isMounted) {
          setData(payload);
        }
      } catch (error) {
        console.error("Failed to fetch open rooms", error);
        if (isMounted) {
          setError(error instanceof Error ? error.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadOpenRooms();

    return () => {
      isMounted = false;
    };
  }, [periods]);

  const periodPressed = (period: number) => {
    setPeriods((prev) =>
      prev.includes(period)
        ? prev.filter((p) => p !== period)
        : [...prev, period]
    );
  };

  const displayRooms: DisplayRoom[] = useMemo(
    () => buildDisplayRooms(data),
    [data]
  );

  const filteredRooms: DisplayRoom[] = useMemo(() => {
    return filterRooms(displayRooms, query, minCapacity, selectedAmenities);
  }, [displayRooms, minCapacity, query, selectedAmenities]);

  useEffect(() => {
    if (
      selectedRoomId &&
      !filteredRooms.some((room) => room.id === selectedRoomId)
    ) {
      setSelectedRoomId(null);
    }
  }, [filteredRooms, selectedRoomId]);

  const availabilitySnapshot = useMemo(() => {
    const total = filteredRooms.length;
    const available = filteredRooms.reduce(
      (count, room) => (room.isAvailableNow ? count + 1 : count),
      0
    );
    return { total, available };
  }, [filteredRooms]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleMinCapacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    setMinCapacity(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
  };

  const toggleAmenityFilter = (slug: string) => {
    setSelectedAmenities((current) =>
      current.includes(slug)
        ? current.filter((amenity) => amenity !== slug)
        : [...current, slug]
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:grid lg:grid-cols-[420px_1fr]">
      <aside className="border-b border-slate-200 bg-white/80 backdrop-blur lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-slate-200">
            <span className="flex items-center gap-3">
              <img src={logoUrl} alt="Logo" className="w-9 h-9" />
              <span>
                <h1 className="text-xl font-semibold text-slate-900">
                  Freerooms@<span className="text-blue-400">UF</span>
                </h1>
              </span>
            </span>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Now showing</p>
              <p className="text-sm font-semibold text-slate-900">
                {availabilitySnapshot.available} open /{" "}
                {availabilitySnapshot.total} rooms
              </p>
            </div>
          </header>

          <section className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Filters</h2>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                aria-expanded={isFilterOpen}
              >
                {isFilterOpen ? "Hide" : "Show"}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`h-4 w-4 transition-transform ${
                    isFilterOpen ? "rotate-180" : ""
                  }`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>
            </div>

            {isFilterOpen ? (
              <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="capacity-range"
                    className="text-sm font-medium text-slate-700"
                  >
                    Minimum capacity
                  </label>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {minCapacity} seat{minCapacity !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className="flex flex-row items-center gap-2">
                  <input
                    id="capacity-range"
                    type="range"
                    min={1}
                    max={700}
                    value={minCapacity}
                    onChange={handleMinCapacityChange}
                    className="w-full accent-slate-600 mr-2"
                    aria-label="Minimum capacity slider"
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4 stroke-4"
                    onClick={() => setMinCapacity(minCapacity + 1)}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 15.75 7.5-7.5 7.5 7.5"
                    />
                  </svg>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4 stroke-4"
                    onClick={() => setMinCapacity(minCapacity - 1)}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m19.5 8.25-7.5 7.5-7.5-7.5"
                    />
                  </svg>
                </span>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Amenities
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    {AMENITY_FILTER_OPTIONS.map((option) => {
                      const isSelected = selectedAmenities.includes(
                        option.slug
                      );
                      return (
                        <button
                          key={option.slug}
                          type="button"
                          onClick={() => toggleAmenityFilter(option.slug)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          aria-pressed={isSelected}
                          aria-label={option.label}
                          title={option.label}
                        >
                          <img
                            src={option.icon}
                            alt=""
                            aria-hidden="true"
                            className="h-5 w-5"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Periods
                  </span>
                  <div className="grid grid-cols-10 justify-center gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <button
                        key={i}
                        className={`px-2 py-1 text-xs bg-slate-200 rounded hover:bg-slate-300 ${
                          periods.includes(i + 1)
                            ? "bg-slate-400 text-white"
                            : ""
                        }`}
                        onClick={() => periodPressed(i + 1)}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="px-6 pb-6 text-sm text-red-600">
              Unable to load rooms: {error}
            </div>
          ) : isLoading ? (
            <div className="px-6 pb-6 text-sm text-slate-600">
              Loading rooms…
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 pb-8">
              <StudyContainer
                filteredRooms={filteredRooms}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                {!error && data.fetchedAt ? (
                  <span>
                    Updated{" "}
                    {new Date(data.fetchedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                ) : (
                  <span>Fetching latest schedule…</span>
                )}
                <span>Term {data.term || "N/A"}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="relative h-[50vh] bg-slate-100 lg:h-screen">
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[1001] flex justify-center">
          <div className="pointer-events-auto w-full max-w-2xl rounded-full border border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm">
            <input
              placeholder="Search building or room…"
              value={query}
              onChange={handleQueryChange}
              className="w-full rounded-full border-0 bg-transparent px-5 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
              aria-label="Search"
            />
          </div>
        </div>
        <MapView
          rooms={filteredRooms}
          selectedRoomId={selectedRoomId}
          onRoomFocus={setSelectedRoomId}
        />
      </main>
    </div>
  );
};

export default App;
