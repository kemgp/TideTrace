import React from "react";

export default function LocationPicker({ location, onChange }) {
  const dropPin = () => {
    const options = ["Brgy. Lawis", "Brgy. Punta", "Brgy. Candayas"];
    onChange(options[Math.floor(Math.random() * options.length)]);
  };
  return (
    <div>
      <div className="ph" style={{ height: 150, cursor: "pointer" }} onClick={dropPin}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ce6d38" strokeWidth={2}>
          <path d="M12 21c-4-4-8-8.5-8-13a8 8 0 0 1 16 0c0 4.5-4 9-8 13Z" />
          <circle cx={12} cy={8} r="2.5" />
        </svg>
        <span>{location ? `Pinned: ${location}` : "Tap to drop a pin at the sighting spot"}</span>
      </div>
      <input
        className="input"
        value={location}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Barangay / landmark — auto-filled from pin"
        style={{ marginTop: 12 }}
      />
      <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={dropPin}>
        📍 Use my current location
      </button>
    </div>
  );
}
