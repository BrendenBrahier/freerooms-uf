import type { Room } from "../types";
import Temp from "../assets/Temp.jpg";
import ADAIcon from "../assets/ADA.svg";
import ChalkboardIcon from "../assets/Chalkboard.svg";
import PowerIcon from "../assets/Power.svg";
import ProjectorIcon from "../assets/Projector.svg";
import React from "react";

const AMENITY_ICON_MAP: Record<string, string> = {
  ada: ADAIcon,
  chalkboard: ChalkboardIcon,
  power: PowerIcon,
  projector: ProjectorIcon,
};

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

  function roomAmenitiesRender(amenities: string[]) {
    return (
      <span className="flex mx-2 justify-between items-center my-2 gap-2">
        {amenities.map((amenity, index) => {
          const normalizedKey = amenity.trim().toLowerCase();
          const iconSrc = AMENITY_ICON_MAP[normalizedKey];

          if (!iconSrc) {
            return (
              <span
                key={`${normalizedKey}-${index}`}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600"
              >
                {amenity}
              </span>
            );
          }

          return (
            <div className="relative inline-block">
              <img
                key={`${normalizedKey}-${index}`}
                src={iconSrc}
                alt={`${amenity} available`}
                title={amenity}
                className="h-5 w-5"
              />
            </div>
          );
        })}
      </span>
    );
  }

  return (
    <li className="rounded-xl border border-slate-200 p-2 shadow-md transition hover:border-slate-300 hover:shadow-lg hover:scale-[101%]">
      <div className="flex flex-col">
        <div>
          <img
            src={Temp}
            alt="Study Spot"
            className="w-full h-40 object-cover rounded-md mb-4"
          />
        </div>
        <strong className="flex-1 text-base text-slate-900">
          {room.building_name} • {room.room_number}
        </strong>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`flex justify-center items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${badgeTone}`}
          >
            Open until {until}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{room.reason}</p>
        <div className="flex flex-wrap justify-between items-center gap-2 text-sm text-slate-600">
          <span className="text-gray-400">Capacity: {room.capacity}</span>
          <span className="flex w-40%">
            {roomAmenitiesRender(room.amenities)}
          </span>
        </div>
      </div>
    </li>
  );
};

export default StudySpot;
