import type { DisplayRoom } from "../types";
import Temp from "../assets/Temp.jpg";
import ADAIcon from "../assets/ADA.svg";
import ChalkboardIcon from "../assets/Chalkboard.svg";
import PowerIcon from "../assets/Power.svg";
import ProjectorIcon from "../assets/Projector.svg";
import React from "react";
import type { JSX } from "react";

const AMENITY_CONFIG: Record<string, { icon: string; label: string }> = {
  ada: { icon: ADAIcon, label: "ADA Accessible" },
  chalkboard: {
    icon: ChalkboardIcon,
    label: "Chalkboard / Whiteboard",
  },
  power: { icon: PowerIcon, label: "Power / BYOD" },
  projector: { icon: ProjectorIcon, label: "Projector" },
};

interface StudySpotProps {
  room: DisplayRoom;
  isActive: boolean;
  onSelect: () => void;
}

const StudySpot: React.FC<StudySpotProps> = ({ room, isActive, onSelect }) => {
  const badgeTone = room.isAvailableNow
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-800";

  const availabilityLabel = room.isAvailableNow
    ? room.nextAvailable
      ? `Open until ${room.nextAvailable.startTime}`
      : "Open now"
    : room.nextAvailable
    ? `Next: ${room.nextAvailable.dayLabel} • ${room.nextAvailable.startTime}`
    : "No availability listed";

  function roomAmenitiesRender(amenities: string[]): JSX.Element {
    if (amenities.length === 0) {
      return (
        <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
          No listed amenities
        </span>
      );
    }

    const rendered = amenities
      .map((slug) => {
        const config = AMENITY_CONFIG[slug];
        if (!config) return null;

        return (
          <div className="relative inline-block" key={slug}>
            <img
              src={config.icon}
              alt={`${config.label} available`}
              title={config.label}
              className="h-5 w-5"
            />
          </div>
        );
      })
      .filter((node): node is JSX.Element => node !== null);

    if (rendered.length === 0) {
      return (
        <span className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
          No listed amenities
        </span>
      );
    }

    return (
      <span className="flex mx-2 justify-between items-center my-2 gap-2 overflow-hidden">
        {rendered}
      </span>
    );
  }

  const cardClasses = [
    "w-full text-left",
    "rounded-xl border p-2 shadow-sm transition",
    "hover:border-slate-300 hover:shadow-lg hover:scale-[101%]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300",
    isActive
      ? "border-blue-500 ring-2 ring-blue-200"
      : "border-slate-200 bg-white/90",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li>
      <button type="button" onClick={onSelect} className={cardClasses}>
        <div className="flex flex-col">
          <div>
            <img
              src={room.photo ?? Temp}
              alt={`${room.buildingName} ${room.roomNumber}`}
              className="w-full h-40 object-cover rounded-md mb-4"
            />
          </div>
          <strong className="flex-1 text-base text-slate-900">
            {room.buildingName} • {room.roomNumber}
          </strong>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`flex justify-center items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${badgeTone}`}
            >
              {availabilityLabel}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Capacity: {room.capacity ?? "Not listed"}
          </p>
          <div className="flex flex-wrap justify-between items-center gap-2 text-sm text-slate-600">
            <div className="flex w-[40%]">
              {roomAmenitiesRender(room.amenities)}
            </div>
          </div>
        </div>
      </button>
    </li>
  );
};

export default StudySpot;
