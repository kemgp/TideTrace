import React from "react";
import { useLocation } from "react-router-dom";
import SkeletonLoader from "./SkeletonLoader.jsx";

export default function RemoteState({ loading, error, retry, compact = false, skeletonPath }) {
  const { pathname } = useLocation();
  if (loading && !compact) return <SkeletonLoader path={skeletonPath || pathname} />;
  if (loading) return <div className="remote-skeleton" role="status" aria-label="Loading content" aria-busy="true">
    <span className="remote-skeleton-line" /><span className="remote-skeleton-line" /><span className="remote-skeleton-line" />
  </div>;
  if (error) return <div><p role="alert">{error}</p><button className="btn outline sm" onClick={retry}>Try again</button></div>;
  return null;
}

export function Pagination({ offset, count, size, onChange, loading }) {
  return <div className="row pagination" aria-label="Pagination" style={{ marginTop: 20 }}>
    <button className="btn outline sm" disabled={loading || offset === 0} onClick={() => onChange(Math.max(0, offset - size))}>Previous page</button>
    <span>Page {Math.floor(offset / size) + 1}</span>
    <button className="btn outline sm" disabled={loading || count < size} onClick={() => onChange(offset + size)}>Next page</button>
  </div>;
}
