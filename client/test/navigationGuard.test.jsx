import React, { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createBrowserRouter, createMemoryRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const category = { id: "category", name: "Seagrass" };
const owner = { id: "owner", role: "user", status: "active", display_name: "Member", email: "member@example.test" };
const trace = (extra = {}) => ({ id: "draft-id", author_id: owner.id, status: "draft", version: 1, category_id: category.id, category,
  title: "Coast visit", description: "Observed seagrass", location_name: "Lawis", latitude: null, longitude: null, trace_media: [], ...extra });
const photo = { id: "photo", trace_id: "draft-id", mime_type: "image/png", object_path: "owner/draft-id/upload.png", sort_order: 0 };
const lesson = (extra = {}) => ({ id: "lesson", title: "Coastal life", slug: "coastal-life", body: "Lesson content", status: "draft", updated_at: "2026-10-19T00:00:00Z", ...extra });
const detail = "/api/contributions/draft-id";
const upload = "/api/traces/draft-id/media";
const submitted = "/api/traces/draft-id/submit";
const newTrace = "/user/traces/upload";
const savedTrace = "/user/contributions/draft-id";
const destination = "/user/tides?from=editor#lessons";
const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (code = "FAILED", status = 400, details) => ({ ok: false, status, json: async () => ({ error: { code, message: "Photo could not be saved.", details } }) });
const png = () => new File([new Uint8Array(12)], "coast.png", { type: "image/png" });
const routers = new Set();
afterEach(() => { routers.forEach(router => router.dispose()); routers.clear(); });

function api(handler = () => undefined, role = "user") {
  const account = { ...owner, role };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options) => {
    const result = await handler(url, options);
    if (result) return result;
    if (url === "/api/auth/me") return ok({ ...account });
    if (url === "/api/categories") return ok([category]);
    if (url === detail) return ok(trace());
    if (url === "/api/admin/tides/lesson") return ok(lesson());
    if (url.endsWith("/url")) return ok({ url: "https://example.test/photo.png" });
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return { calls, account };
}

function NavigationControls() {
  const navigate = useNavigate();
  const location = useLocation();
  return <><output data-testid="location">{location.pathname + location.search + location.hash}</output>
    <button onClick={() => navigate(destination)}>Programmatic destination</button>
    <button onClick={() => navigate(-1)}>History back</button>
    <button onClick={() => navigate(1)}>History forward</button></>;
}
function open(path = newTrace, { initialEntries = [path], initialIndex, browser = false } = {}) {
  if (browser) window.history.replaceState({}, "", path);
  const routes = [{ path: "*", element: <><App /><NavigationControls /></> }];
  const router = browser ? createBrowserRouter(routes) : createMemoryRouter(routes, { initialEntries, initialIndex });
  routers.add(router);
  const view = render(<StrictMode><RouterProvider router={router} /></StrictMode>);
  return { ...view, router };
}
async function fillTrace() {
  await screen.findByRole("option", { name: category.name });
  for (const [label, value] of [["Category (required)", category.id], ["Title", "Coast visit"], ["Description", "Observed seagrass"], ["Location", "Lawis"]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}
async function choosePhoto() {
  const file = png();
  fireEvent.change(await screen.findByLabelText(/^Choose a photo/), { target: { files: [file] } });
  await screen.findByRole("img", { name: "Selected photo preview" });
  return file;
}
const confirmation = () => screen.findByRole("alertdialog", { name: "Unsaved changes" });
async function keepEditing() {
  fireEvent.click(within(await confirmation()).getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}
async function discard() {
  fireEvent.click(within(await confirmation()).getByRole("button", { name: "Discard changes" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}
function unloadPrevented() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

it("lets pristine and reverted forms navigate normally without a browser unload warning", async () => {
  const { calls } = api(); open();
  await screen.findByRole("option", { name: category.name });
  expect(unloadPrevented()).toBe(false);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Temporary" } });
  expect(unloadPrevented()).toBe(true);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });
  expect(unloadPrevented()).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Programmatic destination" }));
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(destination));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it("contains dialog focus, uses Escape to keep editing, and preserves text, file and preview when a navbar link is cancelled", async () => {
  api(); open(); await fillTrace(); await choosePhoto();
  const previewURL = screen.getByRole("img", { name: "Selected photo preview" }).getAttribute("src");
  const user = userEvent.setup();
  const link = screen.getByRole("link", { name: "Tides", exact: true });
  await user.click(link);
  const dialog = await confirmation();
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(document.getElementById(dialog.getAttribute("aria-describedby")).textContent).toBe("You have unsaved changes. Leave this page and discard them?");
  const keep = within(dialog).getByRole("button", { name: "Keep editing" });
  const leave = within(dialog).getByRole("button", { name: "Discard changes" });
  expect(document.activeElement).toBe(keep);
  await user.tab({ shift: true }); expect(document.activeElement).toBe(leave);
  await user.tab(); expect(document.activeElement).toBe(keep);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(document.activeElement).toBe(link);
  expect(screen.getByLabelText("Title").value).toBe("Coast visit");
  expect(screen.getByRole("img", { name: "Selected photo preview" }).getAttribute("src")).toBe(previewURL);
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(previewURL);
  expect(unloadPrevented()).toBe(true);
});

it("discards to the complete originally requested programmatic destination without deleting saved data", async () => {
  const { calls } = api(); open(); await fillTrace();
  fireEvent.click(screen.getByRole("button", { name: "Programmatic destination" }));
  await discard();
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(destination));
  expect(unloadPrevented()).toBe(false);
  expect(calls.mock.calls.some(([, options]) => ["POST", "PUT", "DELETE"].includes(options.method))).toBe(false);
});

it("guards the footer home link through the app router", async () => {
  api(); open(); await fillTrace();
  fireEvent.click(screen.getByRole("link", { name: "TideTrace home" }));
  await keepEditing();
  expect(screen.getByLabelText("Title").value).toBe("Coast visit");
  expect(screen.getByTestId("location").textContent).toBe(newTrace);
});

it.each([["back", "/user/contributions"], ["forward", "/user/tides"]])("guards history %s and preserves the requested entry after cancelling once", async (direction, expected) => {
  api(); open(newTrace, { initialEntries: ["/user/contributions", newTrace, "/user/tides"], initialIndex: 1 });
  await fillTrace();
  fireEvent.click(screen.getByRole("button", { name: `History ${direction}` }));
  await keepEditing();
  expect(screen.getByTestId("location").textContent).toBe(newTrace);
  expect(screen.getByLabelText("Description").value).toBe("Observed seagrass");
  fireEvent.click(screen.getByRole("button", { name: `History ${direction}` }));
  await discard();
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));
});

it("blocks native browser history Back and Forward using the browser data router", async () => {
  api(); const { router } = open("/user/contributions", { browser: true });
  await screen.findByRole("heading", { name: "Your traces & their status" });
  await act(async () => router.navigate(newTrace));
  await screen.findByRole("option", { name: category.name });
  await act(async () => router.navigate("/user/tides"));
  await act(async () => router.navigate(-1));
  await fillTrace();
  act(() => window.history.forward());
  await keepEditing();
  expect(window.location.pathname).toBe(newTrace);
  act(() => window.history.back());
  await discard();
  await waitFor(() => expect(window.location.pathname).toBe("/user/contributions"));
});

it.each(["draft", "revision_requested"])("protects %s edits and becomes clean when fields return to saved values", async status => {
  api(url => url === detail ? ok(trace({ status })) : undefined);
  open(`${savedTrace}/edit`);
  const description = await screen.findByLabelText("Description");
  fireEvent.change(description, { target: { value: "Unsaved revision" } });
  fireEvent.click(screen.getByRole("link", { name: /Back to contribution/ }));
  await keepEditing();
  expect(description.value).toBe("Unsaved revision");
  fireEvent.change(description, { target: { value: trace().description } });
  fireEvent.click(screen.getByRole("link", { name: /Back to contribution/ }));
  await screen.findByRole("heading", { name: trace().title });
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("protects photo recovery after details save, preserves the file on cancellation and clears protection after retry confirmation", async () => {
  let saved, attempts = 0;
  const { calls } = api((url, options) => {
    if (url === "/api/traces") { saved = trace({ ...JSON.parse(options.body) }); return ok(saved); }
    if (url === upload) { if (++attempts === 1) return fail(); saved = { ...saved, trace_media: [photo], version: 2 }; return ok(photo); }
    if (url === detail) return ok(saved);
  });
  open(); await fillTrace(); const file = await choosePhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  await screen.findByRole("heading", { name: "Draft details saved" });
  expect(unloadPrevented()).toBe(true);
  fireEvent.click(screen.getByRole("link", { name: "Open saved draft" }));
  await keepEditing();
  expect(screen.getByRole("img", { name: "Selected photo preview" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry photo upload" }));
  await screen.findByText(/Your details and photo are saved/);
  expect(unloadPrevented()).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Open saved draft" }));
  await screen.findByRole("img", { name: "Trace photo 1" });
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === upload).map(([, options]) => options.body)).toEqual([file, file]);
  expect(saved.status).toBe("draft");
});

it.each([true, false])("keeps uncertain upload recovery protected until an explicit attachment reload; already attached: %s", async attached => {
  let saved = trace();
  const { calls } = api(url => {
    if (url === "/api/traces") return ok(saved);
    if (url === upload) { saved = trace({ version: 2, trace_media: attached ? [photo] : [] }); throw new TypeError("Lost upload response"); }
    if (url === detail) return ok(saved);
  });
  open(); await fillTrace(); await choosePhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  fireEvent.click(await screen.findByRole("link", { name: "Open saved draft" }));
  await keepEditing();
  expect(screen.getByRole("button", { name: "Retry photo upload" }).disabled).toBe(true);
  expect(unloadPrevented()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved attachments" }));
  await screen.findByText(/Saved attachments reloaded/);
  expect(unloadPrevented()).toBe(false);
  expect(screen.queryByRole("img", { name: "Selected photo preview" })).toBeNull();
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
});

it("protects the uploaded object path even after the local file is cleared, then retries attachment without uploading bytes", async () => {
  let saved = trace();
  const { calls } = api(url => {
    if (url === "/api/traces" || url === detail) return ok(saved);
    if (url === upload) return fail("MEDIA_ATTACH_FAILED", 502, { object_path: photo.object_path });
    if (url === `${upload}/attach`) { saved = trace({ trace_media: [photo], version: 2 }); return ok(photo); }
  });
  open(); await fillTrace(); await choosePhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  fireEvent.click(await screen.findByRole("button", { name: "Reload saved attachments" }));
  await screen.findByText(/Saved attachments reloaded/);
  expect(screen.queryByRole("img", { name: "Selected photo preview" })).toBeNull();
  expect(unloadPrevented()).toBe(true);
  fireEvent.click(screen.getByRole("link", { name: "Open saved draft" })); await keepEditing();
  fireEvent.click(screen.getByRole("button", { name: "Retry attachment" }));
  await screen.findByText(/Your details and photo are saved/);
  expect(unloadPrevented()).toBe(false);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(JSON.parse(calls.mock.calls.find(([url]) => url === `${upload}/attach`)[1].body)).toEqual({ object_path: photo.object_path });
});

it("guards a saved draft's selected photo while preserving existing attachments and lets explicit selection removal clear the guard", async () => {
  const { calls } = api(url => url === detail ? ok(trace({ trace_media: [photo] })) : undefined);
  open(savedTrace); await choosePhoto();
  fireEvent.click(screen.getByRole("link", { name: "Edit draft" })); await keepEditing();
  expect(screen.getByRole("img", { name: "Trace photo 1" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Selected photo preview" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear selected photo" }));
  expect(unloadPrevented()).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: "Edit draft" }));
  await screen.findByRole("heading", { name: "Edit your draft" });
  expect(calls.mock.calls.some(([, options]) => ["POST", "DELETE"].includes(options.method))).toBe(false);
});

it("protects a photo while data-saver compression is pending and resumes preparing it after Keep editing", async () => {
  let decode;
  vi.stubGlobal("Image", class {
    naturalWidth = 2000; naturalHeight = 1000;
    set src(value) { decode = () => this.onload(); }
  });
  HTMLCanvasElement.prototype.getContext.mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(done => done(new Blob(["ok"], { type: "image/webp" })));
  const { account, calls } = api(); account.data_saver = true;
  open(); await screen.findByRole("option", { name: category.name });
  fireEvent.change(screen.getByLabelText(/^Choose a photo/), { target: { files: [png()] } });
  await screen.findByText("Preparing smaller photo…");
  fireEvent.click(screen.getByRole("link", { name: "Back to My Contributions" })); await keepEditing();
  expect(screen.getByRole("button", { name: "Browse files" }).disabled).toBe(true);
  await act(async () => decode());
  await screen.findByRole("img", { name: "Selected photo preview" });
  expect(screen.getByText("coast.webp", { selector: ".trace-photo-upload__name" })).toBeTruthy();
  expect(unloadPrevented()).toBe(true);
  expect(calls.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});

it.each(["keep", "discard", "finish-with-dialog-open"])("handles an in-flight draft save with %s without claiming the server cancelled or replaying it", async action => {
  let finish, saved;
  const pending = new Promise(resolve => { finish = resolve; });
  const { calls } = api((url, options) => {
    if (url === "/api/traces") { saved = trace(JSON.parse(options.body)); return pending; }
    if (url === detail) return ok(saved);
  });
  const { router } = open(); await fillTrace();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === "/api/traces")).toBe(true));
  fireEvent.click(screen.getByRole("link", { name: "Back to My Contributions" }));
  expect((await confirmation()).textContent).toContain("It may still save on the server");
  const signal = calls.mock.calls.find(([url]) => url === "/api/traces")[1].signal;
  if (action === "keep") { await keepEditing(); expect(signal.aborted).toBe(false); }
  else if (action === "discard") { await discard(); expect(signal.aborted).toBe(true); }
  await act(async () => finish(ok(saved)));
  if (action === "discard") {
    expect(screen.queryByText(/Draft saved\./)).toBeNull();
    await act(async () => router.navigate(savedTrace)); // A server commit can still be read after client abort.
  }
  await screen.findByRole("heading", { name: trace().title });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(calls.mock.calls.filter(([url]) => url === "/api/traces")).toHaveLength(1);
});

it("continues a blocked destination when attachment recovery finishes while the dialog is open", async () => {
  let saved = trace(), finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { calls } = api(url => {
    if (url === "/api/traces" || url === detail) return ok(saved);
    if (url === upload) return fail("MEDIA_ATTACH_FAILED", 502, { object_path: photo.object_path });
    if (url === `${upload}/attach`) return pending;
  });
  open(); await fillTrace(); await choosePhoto();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save draft" })));
  fireEvent.click(await screen.findByRole("button", { name: "Retry attachment" }));
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === `${upload}/attach`)).toBe(true));
  fireEvent.click(screen.getByRole("link", { name: "Open saved draft" })); await confirmation();
  saved = trace({ trace_media: [photo], version: 2 });
  await act(async () => finish(ok(photo)));
  await screen.findByRole("heading", { name: trace().title });
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(unloadPrevented()).toBe(false);
  expect(calls.mock.calls.filter(([url]) => url === upload)).toHaveLength(1);
  expect(calls.mock.calls.filter(([url]) => url === `${upload}/attach`)).toHaveLength(1);
});

it.each(["new", "existing"])("protects %s lesson edits and preserves them when navigation is cancelled", async kind => {
  api(undefined, "admin"); open(kind === "new" ? "/admin/tides/new" : "/admin/tides/lesson/edit");
  const body = await screen.findByLabelText("Lesson content");
  fireEvent.change(body, { target: { value: "Unsaved lesson" } });
  fireEvent.click(screen.getByRole("link", { name: /Back to Manage Tides/ })); await keepEditing();
  expect(body.value).toBe("Unsaved lesson");
  fireEvent.click(screen.getByRole("link", { name: /Back to Manage Tides/ })); await discard();
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/admin/tides"));
});

it("clears lesson protection after saving, protects subsequent edits and clears it again after reverting", async () => {
  let saved = lesson();
  api((url, options) => {
    if (url === "/api/admin/tides/lesson") {
      if (options.method === "PUT") saved = { ...saved, ...JSON.parse(options.body), updated_at: "2026-10-20T00:00:00Z" };
      return ok(saved);
    }
  }, "admin");
  open("/admin/tides/lesson/edit");
  const body = await screen.findByLabelText("Lesson content");
  fireEvent.change(body, { target: { value: "Saved lesson" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText("Lesson saved as draft");
  expect(unloadPrevented()).toBe(false);
  fireEvent.change(body, { target: { value: "Another edit" } }); expect(unloadPrevented()).toBe(true);
  fireEvent.change(body, { target: { value: "Saved lesson" } }); expect(unloadPrevented()).toBe(false);
  fireEvent.click(screen.getByRole("link", { name: /Back to Manage Tides/ }));
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/admin/tides"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("protects an uncertain lesson save and never replays it when navigation is cancelled", async () => {
  const { calls } = api((url, options) => url === "/api/admin/tides/lesson" && options.method === "PUT" ? fail("FAILED", 503) : undefined, "admin");
  open("/admin/tides/lesson/edit");
  fireEvent.change(await screen.findByLabelText("Lesson content"), { target: { value: "Keep this lesson text" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText(/We could not confirm the save/);
  fireEvent.click(screen.getByRole("link", { name: /Back to Manage Tides/ })); await keepEditing();
  expect(screen.getByLabelText("Lesson content").value).toBe("Keep this lesson text");
  expect(screen.getByLabelText("Lesson content").closest("fieldset").disabled).toBe(true);
  expect(calls.mock.calls.filter(([, options]) => options.method === "PUT")).toHaveLength(1);
  expect(unloadPrevented()).toBe(true);
});

it("allows a successful Trace submission redirect without prompting or uploading its photo again", async () => {
  let saved;
  const { calls } = api((url, options) => {
    if (url === "/api/traces") { saved = trace(JSON.parse(options.body)); return ok(saved); }
    if (url === upload) { saved = { ...saved, trace_media: [photo], version: 2 }; return ok(photo); }
    if (url === detail) return ok(saved);
    if (url === submitted) { saved = { ...saved, status: "pending", version: 3 }; return ok(saved); }
  });
  open(); await fillTrace(); await choosePhoto();
  fireEvent.click(screen.getByRole("button", { name: "Submit Trace" }));
  await screen.findByText(/Your Trace is awaiting a reviewer/);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(unloadPrevented()).toBe(false);
  expect(calls.mock.calls.filter(([, options]) => options.method === "POST").map(([url]) => url)).toEqual(["/api/traces", upload, submitted]);
});

it.each(["logout", "expiry", "role"])("does not trap a dirty editor during %s changes, including an already open dialog", async change => {
  let expired = false;
  const { account } = api(url => expired && ["/api/auth/me", "/api/auth/refresh"].includes(url) ? fail("UNAUTHENTICATED", 401) : undefined);
  open(); await fillTrace(); await choosePhoto();
  if (change === "logout") fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  else {
    fireEvent.click(screen.getByRole("button", { name: "Programmatic destination" })); await confirmation();
    if (change === "expiry") expired = true;
    else account.role = "moderator";
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
    fireEvent(window, new Event("focus"));
  }
  await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(change === "role" ? "/moderator/dashboard" : "/login"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(unloadPrevented()).toBe(false);
});
