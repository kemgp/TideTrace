import React, { useEffect, useRef } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import "./RouteError.css";

// Shown by the router when a page crashes while rendering, in place of React Router's developer screen.
// It must not depend on the app's own providers (they may be what crashed), so it uses plain links and a full reload.
export default function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const detail = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return <main className="route-error">
    <div className="route-error-card">
      <svg className="route-error-mark" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      </svg>
      <h1 ref={heading} tabIndex={-1}>{notFound ? "Page not found" : "Something went wrong"}</h1>
      <p>{notFound ? "We could not find that page. It may have moved, or the link may be wrong." : "TideTrace ran into an unexpected problem. Reloading the page usually fixes it."}</p>
      <div className="route-error-actions">
        {!notFound && <button type="button" className="btn blue" onClick={() => window.location.reload()}>Reload page</button>}
        <a className={`btn ${notFound ? "blue" : "outline"}`} href="/">Go to home</a>
      </div>
      {import.meta.env.DEV && detail && <details className="route-error-details">
        <summary>Technical details</summary>
        <pre>{detail}</pre>
      </details>}
    </div>
  </main>;
}
