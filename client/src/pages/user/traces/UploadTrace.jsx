import React from "react";
import { useLocation } from "react-router-dom";
import { coordinates } from "../../../api/maps.js";
import { useApp } from "../../../context/AppContext.jsx";
import TraceDraftForm from "../../../components/TraceDraftForm.jsx";

export default function UploadTrace() {
  const { state, key } = useLocation();
  const point = coordinates(state?.traceLocation?.latitude, state?.traceLocation?.longitude);
  const { profile } = useApp();
  return <div className="wrap user-upload"><TraceDraftForm key={`${profile.id}:${key}`} initialLocation={point ? { latitude: point.lat, longitude: point.lng } : null} /></div>;
}
