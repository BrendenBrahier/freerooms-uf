import axios from "axios";

// - `GET /api/rooms/open`
//   Query params (optional):
//   - `size`: minimum capacity bucket (e.g., `10`, `25`)
//   - `buildingId`: STARS building ID (e.g., `B800000007`)
//   - `buildingCode`: campus code (e.g., `AND`)
//   - `room`: room number (e.g., `0013`)
//     Response includes:
//   - `periodStartTimes`: mapping of STARS periods to 12‑hour start times
//   - `buildings[]` → `rooms[]` → `availability` keyed by size
//   - Each size entry contains:
//     - `periods[]` with `day`, `period`, `startTime`, `endTime` (12‑hour strings)
//     - `isAvailableNow` (boolean) based on current Eastern time
//     - `nextAvailable` (next day/period/time if the room is currently unavailable)
// - `GET /api/rooms/:id` (e.g., `/api/rooms/AND-0013`)  
//   Returns the single building/room record with the same structure as above.
// - `GET /api/buildings`  
//   Returns basic building metadata and room counts (no availability payload).

import type { RoomsResponse } from "../types";

const BASE = "/api";

export interface RoomsQueryParams {
  size?: number;
  buildingId?: string;
  buildingCode?: string;
  room?: string;
  periods?: number[];
}

export const fetchStudyRooms = {
  rooms: async (params: RoomsQueryParams = {}): Promise<RoomsResponse> => {
    const { periods, ...rest } = params;
    const query: Record<string, unknown> = { ...rest };
    if (periods && periods.length > 0) {
      query.periods = periods.join(",");
    }

    const response = await axios.get<RoomsResponse>(`${BASE}/rooms/open`, {
      params: query,
    });
    return response.data;
  },
};

