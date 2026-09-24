import React from "react";
import { useApp } from "../../../context/AppContext.jsx";
import TraceDraftForm from "../../../components/TraceDraftForm.jsx";

export default function UploadTrace() {
  const { profile } = useApp();
  return <div className="wrap" style={{ maxWidth: 760 }}><TraceDraftForm key={profile.id} /></div>;
}
