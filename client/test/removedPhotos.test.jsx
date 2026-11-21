import React from "react";
import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useApp } from "../src/context/AppContext.jsx";
import RemovedPhotos from "../src/components/RemovedPhotos.jsx";

vi.mock("../src/context/AppContext.jsx", () => ({ useApp: vi.fn() }));

const traceId = "20000000-0000-4000-8000-000000000001";
const photo = (overrides = {}) => ({ id: "40000000-0000-4000-8000-000000000009", mime_type: "image/jpeg", removed_at: "2026-11-20T10:00:00Z", keep_until: null, ...overrides });

function setup(list) {
  const readData = vi.fn(async (path, options = {}) => {
    if (path === `moderation/traces/${traceId}/removed-photos`) { if (list instanceof Error) throw list; return list; }
    if (options.as === "blob") return new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });
    return null;
  });
  useApp.mockReturnValue({ readData, profile: { id: "staff", role: "moderator" } });
  return readData;
}

it("shows photos removed during a revision to staff, as files rather than links", async () => {
  const readData = setup([photo(), photo({ id: "40000000-0000-4000-8000-000000000010", keep_until: "2026-12-21T10:00:00Z" })]);
  const view = render(<RemovedPhotos traceId={traceId} />);
  expect(await screen.findByRole("heading", { name: "Removed during revision" })).toBeTruthy();
  expect(screen.getByText("Removed 20 Nov 2026. Kept until 30 days after the final decision.")).toBeTruthy();
  expect(screen.getByText("Removed 20 Nov 2026. Kept until 21 Dec 2026.")).toBeTruthy();
  const image = await screen.findByAltText("Removed photo 1");
  expect(image.getAttribute("src")).toMatch(/^blob:/);
  expect(readData).toHaveBeenCalledWith(`moderation/traces/${traceId}/removed-photos/40000000-0000-4000-8000-000000000009/file?size=thumb`, expect.objectContaining({ as: "blob" }));
  view.unmount();
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
});

it("shows nothing when no photos were removed, and an error with a retry when the list fails", async () => {
  setup([]);
  const empty = render(<RemovedPhotos traceId={traceId} />);
  await waitFor(() => expect(useApp().readData).toHaveBeenCalled());
  expect(screen.queryByRole("heading", { name: "Removed during revision" })).toBeNull();
  empty.unmount();
  setup(new Error("offline"));
  render(<RemovedPhotos traceId={traceId} />);
  expect((await screen.findByRole("alert")).textContent).toBe("Could not load removed photos.");
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});
