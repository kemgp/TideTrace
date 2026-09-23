import React from "react";

export default function RemoteState({ loading, error, retry }) {
  if (loading) return <p role="status">Loading…</p>;
  if (error) return <div><p role="alert">{error}</p><button className="btn outline sm" onClick={retry}>Try again</button></div>;
  return null;
}

export function Pagination({ offset, count, size, onChange, loading }) {
  return <div className="row" style={{ marginTop: 20 }}>
    <button className="btn outline sm" disabled={loading || offset === 0} onClick={() => onChange(Math.max(0, offset - size))}>Previous page</button>
    <span>Page {Math.floor(offset / size) + 1}</span>
    <button className="btn outline sm" disabled={loading || count < size} onClick={() => onChange(offset + size)}>Next page</button>
  </div>;
}
