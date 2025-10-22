import { useMemo, useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import MapView from "./components/MapView";
import type { Room, RoomsResponse } from "./types.ts";
import StudyContainer from "./StudyContainer";
import { filterRooms } from "./utils/roomFilters";
import logoUrl from "./assets/Logo.svg";

const DEFAULT_STATE: RoomsResponse = { rooms: [], as_of: null };

const App = () => {
  const [data, setData] = useState<RoomsResponse>(DEFAULT_STATE);
  const [minCapacity, setMinCapacity] = useState<number>(1);
  const [query, setQuery] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const loadOpenRooms = async () => {
      try {
        const response = await fetch("/api/rooms/open");
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = (await response.json()) as RoomsResponse;
        if (isMounted) {
          setData({
            as_of: payload.as_of ?? null,
            rooms: Array.isArray(payload.rooms) ? payload.rooms : [],
          });
        }
      } catch (error) {
        console.error("Failed to fetch open rooms", error);
      }
    };

    void loadOpenRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRooms: Room[] = useMemo(() => {
    return filterRooms(data.rooms, query, minCapacity);
  }, [data.rooms, minCapacity, query]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleMinCapacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    setMinCapacity(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white lg:grid lg:grid-cols-[420px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <span className="flex items-center gap-4 p-1 m-1 mb-6 text-4xl font-bold">
          <img src={logoUrl} alt="Logo" className="w-10 h-10 mr-2" />
          Freeroom@UF
        </span>
        <div className="mb-4 flex flex-col gap-2">
          <span className="flex justify-between items-center text-sm text-slate-600 gap-2">
            Filter by minimum capacity:
            <input
              type="number"
              min={1}
              value={minCapacity}
              onChange={handleMinCapacityChange}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-400/60"
              aria-label="Minimum capacity"
            />
          </span>
        </div>

        <StudyContainer filteredRooms={filteredRooms} />
      </aside>

      <main className="h-[50vh] bg-slate-50 lg:h-screen relative">
        <div className="absolute w-[90%] top-4 left-1/2 transform -translate-x-1/2 z-[1001] p-2 rounded-lg">
          <input
            placeholder="Search building or room…"
            value={query}
            onChange={handleQueryChange}
            className="flex w-full rounded-lg px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2 bg-white border border-slate-300 focus:border-slate-400 focus:ring-slate-400/60"
            aria-label="Search"
          />
        </div>
        <MapView rooms={filteredRooms} />
      </main>
    </div>
  );
};

export default App;
