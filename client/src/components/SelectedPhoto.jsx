import React, { useEffect, useState } from "react";
export default function SelectedPhoto({ file }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return url ? <img src={url} alt="Selected photo preview" className="trace-photo-upload__thumbnail" /> : null;
}
