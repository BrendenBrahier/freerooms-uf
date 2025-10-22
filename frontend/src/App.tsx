import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import MapView from "./components/MapView";
import type { Room, RoomsResponse } from "./types.ts";

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
    const normalizedQuery = query.trim().toLowerCase();
    return data.rooms
      .filter((room: Room) => room.capacity >= minCapacity)
      .filter((room: Room) => {
        if (!normalizedQuery) return true;
        return (
          room.building_name.toLowerCase().includes(normalizedQuery) ||
          room.room_id.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [data.rooms, minCapacity, query]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleMinCapacityChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number(event.target.value);
    setMinCapacity(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white lg:grid lg:grid-cols-[420px_1fr] lg:gap-3">
      <aside className="border-b border-slate-200 bg-white p-4 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <span className="flex p-1 m-1 text-5xl font-bold">Freeroom@UF</span>
        <div className="mb-4 flex gap-2">
          <input
            placeholder="Search building or room…"
            value={query}
            onChange={handleQueryChange}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-400/60"
            aria-label="Search"
          />
          <input
            type="number"
            min={1}
            value={minCapacity}
            onChange={handleMinCapacityChange}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-400/60"
            aria-label="Minimum capacity"
            title="Minimum seats"
          />
        </div>

        {filteredRooms.length === 0 ? (
          <p className="text-sm text-slate-600">No rooms match your filters.</p>
        ) : (
          <ul className="space-y-3">
            {filteredRooms.map((room) => {
              const badgeTone =
                room.closes_in_minutes <= 30
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700";
              const until = new Date(room.open_until).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <li
                  key={room.room_id}
                  className="rounded-xl border border-slate-200 p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-base text-slate-900">
                      {room.building_name} • {room.room_number}
                    </strong>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeTone}`}
                    >
                      Open until {until}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{room.reason}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span>Capacity: {room.capacity}</span>
                    <span aria-hidden="true">•</span>
                    <span>{room.amenities.join(", ")}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <main className="h-[50vh] bg-slate-50 lg:h-screen">
        <MapView rooms={filteredRooms} />
      </main>
    </div>
  );
};

export default App;
