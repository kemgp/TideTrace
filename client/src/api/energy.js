// Tide Energy screens stay hidden unless the build sets VITE_ENERGY_ENABLED=true. Off is the default.
// Read at call time so tests can switch it. The server has its own ENERGY_ENABLED flag; set both together.
export const energyEnabled = () => String(import.meta.env.VITE_ENERGY_ENABLED || "").trim().toLowerCase() === "true";
