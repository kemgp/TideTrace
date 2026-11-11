// Tide Energy screens stay hidden unless the build sets VITE_ENERGY_ENABLED=true. Off is the default.
// Read at call time so tests can switch it. The server has its own ENERGY_ENABLED flag; set both together.
export const energyEnabled = () => String(import.meta.env.VITE_ENERGY_ENABLED || "").trim().toLowerCase() === "true";

// Tells the navbar pill to read the balance again. Call it right after something may have earned energy
// (finishing a lesson, passing a quiz), since those happen on the same page and no navigation follows.
export const ENERGY_CHANGED = "tidetrace:energy-changed";
export const notifyEnergyChanged = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(ENERGY_CHANGED)); };
