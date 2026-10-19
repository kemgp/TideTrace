import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const browserURL = URL;
const urlMethods = ["createObjectURL", "revokeObjectURL"];
const originalMethods = urlMethods.map((name) => Object.getOwnPropertyDescriptor(browserURL, name));

beforeEach(() => {
  // jsdom lacks object URLs. Keep its URL constructor, Blob and File intact;
  // distinct handles let preview tests detect revoking the wrong selection.
  let nextURL = 0;
  Object.defineProperties(browserURL, {
    createObjectURL: { configurable: true, writable: true, value: vi.fn((blob) => {
      if (!(blob instanceof Blob)) throw new TypeError("An object URL requires a Blob or File.");
      return `blob:tidetrace-test-${++nextURL}`;
    }) },
    revokeObjectURL: { configurable: true, writable: true, value: vi.fn() },
  });
  // Model unavailable canvas contexts, not drawing or successful encoding.
  // Photo export/compression tests install their own scoped 2D/toBlob doubles.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  urlMethods.forEach((name, index) => {
    if (originalMethods[index]) Object.defineProperty(browserURL, name, originalMethods[index]);
    else delete browserURL[name];
  });
  if (vi.isFakeTimers()) vi.clearAllTimers();
  vi.useRealTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  document.documentElement.classList.remove("dark-mode");
});
