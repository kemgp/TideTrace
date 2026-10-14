import React from "react";
import { useApp } from "../context/AppContext.jsx";
import AvatarImage from "./AvatarImage.jsx";

export default function AuthorAvatar({ authorId, name, url }) {
  const { profile } = useApp();
  // The signed-in author's latest profile overrides older feed snapshots.
  const photo = authorId && authorId === profile?.id ? profile.avatar_url : url;
  return <span className="avatar author-avatar">
    <AvatarImage name={name} url={photo} alt={`${name || "Community member"}'s profile photo`} />
  </span>;
}
