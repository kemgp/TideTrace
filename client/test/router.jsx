import React, { createContext, useContext, useState } from "react";
import { createBrowserRouter, createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach } from "vitest";

const Contents = createContext(null);
const routers = new Set();
function TestContents() { return useContext(Contents); }
afterEach(() => { routers.forEach(router => router.dispose()); routers.clear(); });

function TestRouter({ children, browser, initialEntries, initialIndex }) {
  const [router] = useState(() => {
    const routes = [{ path: "*", element: <TestContents /> }];
    const result = browser ? createBrowserRouter(routes) : createMemoryRouter(routes, { initialEntries, initialIndex });
    routers.add(result);
    return result;
  });
  return <Contents.Provider value={children}><RouterProvider router={router} /></Contents.Provider>;
}

export function MemoryRouter(props) { return <TestRouter {...props} />; }
export function BrowserRouter(props) { return <TestRouter {...props} browser />; }
