import React, { useState } from "react";

export default function AvatarImage({ name, url, alt = "Profile photo" }) {
  const [failedUrl, setFailedUrl] = useState(null);
  return url && failedUrl !== url
    ? <img className="profile-avatar-image" src={url} alt={alt} referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
    : <span aria-hidden="true">{name?.trim().charAt(0).toUpperCase() || "?"}</span>;
}
