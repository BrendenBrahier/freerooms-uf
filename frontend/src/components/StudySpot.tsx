import { useState, useEffect, useMemo } from "react";
import type { Room } from "../types";

interface StudySpotProps {
  room: Room;
}

const StudySpot: React.FC<StudySpotProps> = ({ room }) => {
  const badgeTone =
    room.closes_in_minutes <= 30
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-700";
  const until = new Date(room.open_until).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <li className="rounded-xl border border-slate-200 p-4 shadow-md transition hover:border-slate-300 hover:shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <strong className="flex-1 text-base text-slate-900">
          {room.building_name} • {room.room_number}
        </strong>
        <span
          className={`flex justify-center items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${badgeTone}`}
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
};

export default StudySpot;
