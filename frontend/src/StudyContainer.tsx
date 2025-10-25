import type { DisplayRoom } from "./types";
import StudySpot from "./components/StudySpot";

interface StudyContainerProps {
  filteredRooms: DisplayRoom[];
}

const StudyContainer: React.FC<StudyContainerProps> = ({ filteredRooms }) => {
  if (filteredRooms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">
        Try widening your filters or adjusting the capacity slider to see more
        rooms.
      </div>
    );
  }

  return (
    <ul className="space-y-4" aria-live="polite">
      {filteredRooms.map((room) => (
        <StudySpot key={room.id} room={room} />
      ))}
    </ul>
  );
};

export default StudyContainer;
