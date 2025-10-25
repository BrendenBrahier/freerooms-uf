import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DisplayRoom } from "../types";

interface MapViewProps {
  rooms: DisplayRoom[];
}

interface BuildingGroup {
  buildingId: string;
  buildingName: string;
  lat: number;
  lng: number;
  rooms: DisplayRoom[];
}

const MapView = ({ rooms }: MapViewProps) => {
  // Ensure Leaflet marker assets load correctly when bundled
  const iconPrototype = L.Icon.Default.prototype as unknown as {
    _getIconUrl?: string;
  };
  if (iconPrototype._getIconUrl) {
    delete iconPrototype._getIconUrl;
  }

  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  const center: [number, number] = [29.6516, -82.342];

  const buildingGroups: BuildingGroup[] = useMemo(() => {
    const groups = new Map<string, BuildingGroup>();

    rooms.forEach((room) => {
      if (room.lat === null || room.lng === null) {
        return;
      }

      const existing = groups.get(room.buildingId);
      if (existing) {
        existing.rooms.push(room);
      } else {
        groups.set(room.buildingId, {
          buildingId: room.buildingId,
          buildingName: room.buildingName,
          lat: room.lat,
          lng: room.lng,
          rooms: [room],
        });
      }
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      rooms: group.rooms.slice().sort((a, b) =>
        a.roomNumber.localeCompare(b.roomNumber, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      ),
    }));
  }, [rooms]);

  const [activeRoomIndex, setActiveRoomIndex] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    setActiveRoomIndex((prev) => {
      const next: Record<string, number> = {};
      let changed = false;

      buildingGroups.forEach((group) => {
        const prevIndex = prev[group.buildingId] ?? 0;
        const boundedIndex = Math.min(prevIndex, group.rooms.length - 1);
        next[group.buildingId] = boundedIndex;
        if (boundedIndex !== prevIndex || !(group.buildingId in prev)) {
          changed = true;
        }
      });

      if (!changed) {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length !== nextKeys.length) {
          changed = true;
        } else {
          for (const key of prevKeys) {
            if (!(key in next)) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : prev;
    });
  }, [buildingGroups]);

  const handleNavigate = (buildingId: string, delta: 1 | -1) => {
    setActiveRoomIndex((prev) => {
      const group = buildingGroups.find(
        (candidate) => candidate.buildingId === buildingId
      );
      if (!group || group.rooms.length <= 1) {
        return prev;
      }

      const current = prev[buildingId] ?? 0;
      const count = group.rooms.length;
      const nextIndex = (current + delta + count) % count;

      if (nextIndex === current) {
        return prev;
      }

      return {
        ...prev,
        [buildingId]: nextIndex,
      };
    });
  };

  return (
    <div className="h-full w-full">
      <MapContainer center={center} zoom={15}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {buildingGroups.map((group) => {
          const activeIndex = activeRoomIndex[group.buildingId] ?? 0;
          const room = group.rooms[activeIndex];

          return (
            <Marker key={group.buildingId} position={[group.lat, group.lng]}>
              <Popup>
                <div style={{ minWidth: 240 }}>
                  {room.photo ? (
                    <img
                      src={room.photo}
                      alt={`${group.buildingName} ${room.roomNumber}`}
                      className="w-full h-42 object-cover rounded-md mb-3"
                    />
                  ) : null}
                  <strong className="flex w-full">
                    {group.buildingName} • {room.roomNumber}
                  </strong>
                  <div className="mt-1 text-sm">
                    Status:{" "}
                    <span
                      className={
                        room.isAvailableNow ? "text-green-600" : "text-red-600"
                      }
                    >
                      {room.isAvailableNow ? "Available now" : "Unavailable"}
                    </span>
                    {room.nextAvailable ? (
                      <>
                        <br />
                        Next availability: {room.nextAvailable.dayLabel} •{" "}
                        {room.nextAvailable.startTime}
                      </>
                    ) : null}
                    <br />
                    Capacity: {room.capacity ?? "Unknown"}
                  </div>
                  {room.detailUrl ? (
                    <div className="mt-2 text-sm">
                      <a
                        href={room.detailUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        View details
                      </a>
                    </div>
                  ) : null}
                  {group.rooms.length > 1 ? (
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleNavigate(group.buildingId, -1);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-slate-500">
                        Room {activeIndex + 1} of {group.rooms.length}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleNavigate(group.buildingId, 1);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
