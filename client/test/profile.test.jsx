import React, { StrictMode } from "react";
import { expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

function preparePhoto() {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selected-photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(new Blob(["cropped photo"], { type: "image/png" })));
}
async function previewAndSave() {
  const preview = await screen.findByAltText("Selected photo preview");
  Object.defineProperties(preview, { naturalWidth: { value: 800, configurable: true }, naturalHeight: { value: 600, configurable: true } });
  fireEvent.load(preview);
  fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
}

const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const failure = (status = 400) => ({ ok: false, status, json: async () => ({ error: { code: "FAILED", message: "Profile save failed." } }) });
function setup(role = "admin", handler = () => undefined) {
  preparePhoto();
  const account = { id: "owner-id", display_name: "Original Name", email: "member@example.test", role, status: "active" };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "live-access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url, options) => {
    const result = await handler(url, options, account);
    if (result) return result;
    if (url === "/api/auth/me") return ok({ ...account });
    if (url === "/api/profile" && options.method === "PATCH") { account.display_name = JSON.parse(options.body).display_name; return ok({ id: account.id, display_name: account.display_name }); }
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  return { calls, account };
}
const open = (path) => render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
async function openForm(role) {
  const view = open(`/${role === "moderator" ? "moderator" : role}/profile`);
  if (role !== "user") fireEvent.click(await screen.findByRole("button", { name: /Basic information/ }));
  await screen.findByLabelText("Full name");
  return view;
}

it.each(["user", "moderator", "admin"])("persists the %s display name and reloads the saved profile", async (role) => {
  const { calls } = setup(role);
  const view = await openForm(role);
  expect(screen.getByLabelText("Email address").readOnly).toBe(true);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "  Updated Name  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Display name saved.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Profile settings" }).textContent).toBe("U"));
  const writes = calls.mock.calls.filter(([url]) => url === "/api/profile");
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body)).toEqual({ display_name: "Updated Name" });
  expect(writes[0][1].headers.Authorization).toBe("Bearer live-access");
  view.unmount();
  await openForm(role);
  expect(screen.getByLabelText("Full name").value).toBe("Updated Name");
});

it("rejects an empty name without writing and never reports success after a rejected save", async () => {
  const { calls } = setup("admin", (url) => url === "/api/profile" ? failure() : undefined);
  await openForm("admin");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Enter a name between 1 and 100 characters.");
  expect(calls.mock.calls.some(([url]) => url === "/api/profile")).toBe(false);
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "New Name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Profile save failed.");
  expect(screen.queryByText("Display name saved.")).toBeNull();
  expect(screen.getByLabelText("Full name").value).toBe("New Name");
});

it("checks an uncertain save by reloading instead of replaying it", async () => {
  const { calls } = setup("moderator", (url, options, account) => {
    if (url === "/api/profile") { account.display_name = JSON.parse(options.body).display_name; throw new TypeError("Lost response"); }
  });
  await openForm("moderator");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Saved Despite Timeout" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/We could not confirm the save/);
  expect(screen.getByLabelText("Full name").closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved profile" }));
  await screen.findByText("Saved profile reloaded.");
  expect(screen.getByLabelText("Full name").value).toBe("Saved Despite Timeout");
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile")).toHaveLength(1);
});

it("prevents duplicate saves and discards success after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { calls } = setup("admin", (url) => url === "/api/profile" ? pending : undefined);
  await openForm("admin");
  const button = screen.getByRole("button", { name: "Save changes" });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(calls.mock.calls.filter(([url]) => url === "/api/profile")).toHaveLength(1));
  expect(button.closest("fieldset").disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(ok({ id: "owner-id", display_name: "Original Name" })));
  expect(screen.queryByText("Display name saved.")).toBeNull();
});

it.each(["user", "moderator", "admin"])("routes %s password changes through the real recovery flow", async (role) => {
  const { calls } = setup(role);
  await openForm(role);
  fireEvent.click(screen.getByRole("button", { name: /Security/ }));
  const link = await screen.findByRole("link", { name: "Reset password" });
  expect(link.getAttribute("href")).toBe("/forgot-password");
  expect(screen.queryByPlaceholderText("Enter current password")).toBeNull();
  fireEvent.click(link);
  await screen.findByRole("heading", { name: "Password recovery" });
  expect(calls.mock.calls.some(([url]) => url === "/api/auth/password")).toBe(false);
});

it.each(["admin", "moderator"])("prevents a member from opening the %s profile route", async (role) => {
  setup("user"); open(`/${role}/profile`);
  await screen.findByText(/Kumusta/);
  expect(screen.queryByRole("button", { name: /Basic information/ })).toBeNull();
});

it("keeps unsupported staff preferences disabled", async () => {
  setup("moderator"); open("/moderator/profile");
  await screen.findByRole("button", { name: "Edit profile photo" });
  fireEvent.click(screen.getByRole("button", { name: /Preferences/ }));
  await screen.findByText(/Email notification preferences are not available yet/);
  expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
});

it.each(["user", "moderator", "admin"])("saves and restores the %s profile photo, including the navigation avatar", async (role) => {
  const { calls } = setup(role, (url, options, account) => {
    if (url === "/api/profile/photo") {
      account.avatar_path = "owner-id/new-photo.png";
      account.avatar_url = "https://example.test/new-photo.png";
      return ok({ id: account.id, avatar_path: account.avatar_path });
    }
  });
  const view = open(`/${role}/profile`);
  const picker = await screen.findByLabelText("Choose profile photo");
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  fireEvent.change(picker, { target: { files: [file] } });
  await previewAndSave();
  await screen.findByText("Profile photo saved.");
  expect(screen.getAllByAltText("Profile photo")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Profile settings" }).querySelector("img").src).toBe("https://example.test/new-photo.png");
  const writes = calls.mock.calls.filter(([url]) => url === "/api/profile/photo");
  expect(writes).toHaveLength(1);
  expect(writes[0][1].body).not.toBe(file);
  expect(writes[0][1].body.name).toBe("profile-photo.png");
  expect(writes[0][1].body.type).toBe("image/png");
  expect(writes[0][1].headers.Authorization).toBe("Bearer live-access");
  expect(picker.value).toBe("");
  view.unmount();
  open(`/${role}/profile`);
  await screen.findByRole("button", { name: "Edit profile photo" });
  expect(screen.getAllByAltText("Profile photo").every((img) => img.src === "https://example.test/new-photo.png")).toBe(true);
});

it("rejects invalid photos locally and preserves the saved photo after a rejected upload", async () => {
  const { calls, account } = setup("user", (url) => url === "/api/profile/photo" ? failure() : undefined);
  account.avatar_url = "https://example.test/old.png";
  open("/user/profile");
  const picker = await screen.findByLabelText("Choose profile photo");
  for (const file of [new File(["svg"], "bad.svg", { type: "image/svg+xml" }), new File([], "empty.png", { type: "image/png" }), new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })]) {
    fireEvent.change(picker, { target: { files: [file] } });
    await screen.findByText(/Choose a non-empty JPEG/);
  }
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile/photo")).toHaveLength(0);
  fireEvent.change(picker, { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
  await previewAndSave();
  await screen.findByText("Profile save failed.");
  expect(screen.queryByText("Profile photo saved.")).toBeNull();
  expect(screen.getAllByAltText("Profile photo").every((img) => img.src === "https://example.test/old.png")).toBe(true);
});

it("reloads an uncertain photo upload without replaying the write", async () => {
  const { calls } = setup("user", (url, options, account) => {
    if (url === "/api/profile/photo") {
      account.avatar_path = "owner-id/saved.png";
      account.avatar_url = "https://example.test/saved.png";
      throw new TypeError("Lost response");
    }
  });
  open("/user/profile");
  fireEvent.change(await screen.findByLabelText("Choose profile photo"), { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
  await previewAndSave();
  await screen.findByText(/We could not confirm the photo change/);
  expect(screen.getByRole("button", { name: "Choose photo" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved profile" }));
  await screen.findByText("Saved profile reloaded.");
  expect(screen.getAllByAltText("Profile photo")).toHaveLength(2);
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile/photo")).toHaveLength(1);
});

it("prevents duplicate photo uploads and discards late results after logout", async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { calls } = setup("user", (url) => url === "/api/profile/photo" ? pending : undefined);
  open("/user/profile");
  const picker = await screen.findByLabelText("Choose profile photo");
  const file = new File(["photo"], "photo.png", { type: "image/png" });
  fireEvent.change(picker, { target: { files: [file] } });
  fireEvent.change(picker, { target: { files: [file] } });
  await previewAndSave();
  fireEvent.click(screen.getByRole("button", { name: "Saving photo…" }));
  await waitFor(() => expect(calls.mock.calls.filter(([url]) => url === "/api/profile/photo")).toHaveLength(1));
  expect(screen.getByRole("button", { name: "Saving photo…" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Log out" }));
  await screen.findByRole("heading", { name: "Welcome to TideTrace" });
  await act(async () => finish(ok({ id: "owner-id", avatar_path: "owner-id/photo.png" })));
  expect(screen.queryByText("Profile photo saved.")).toBeNull();
});

it("offers recovery when the saved photo cannot be loaded", async () => {
  const { calls, account } = setup("user", (url, options, saved) => {
    if (url === "/api/profile/photo") {
      saved.avatar_path = "owner-id/photo.png";
      return ok({ id: saved.id, avatar_path: saved.avatar_path });
    }
  });
  open("/user/profile");
  fireEvent.change(await screen.findByLabelText("Choose profile photo"), { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
  await previewAndSave();
  await screen.findByText(/We could not confirm the photo change/);
  expect(screen.queryByText("Profile photo saved.")).toBeNull();
  account.avatar_url = "https://example.test/photo.png";
  fireEvent.click(screen.getByRole("button", { name: "Reload saved profile" }));
  await screen.findByText("Saved profile reloaded.");
  expect(screen.getAllByAltText("Profile photo")).toHaveLength(2);
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile/photo")).toHaveLength(1);
});

it("previews without uploading, adjusts the crop, and cancels without changing saved avatars", async () => {
  const { calls, account } = setup("user");
  account.avatar_url = "https://example.test/saved.png";
  open("/user/profile");
  const picker = await screen.findByLabelText("Choose profile photo");
  fireEvent.change(picker, { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
  const image = await screen.findByAltText("Selected photo preview");
  expect(screen.getByRole("button", { name: "Save photo" }).disabled).toBe(true);
  Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  fireEvent.load(image);
  fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
  fireEvent.keyDown(screen.getByRole("group", { name: "Circular photo preview" }), { key: "ArrowLeft" });
  expect(image.style.width).toBe(`${800 / 300 * 100}%`);
  expect(image.style.left).toBe("-87.5%");
  expect(calls.mock.calls.some(([url]) => url === "/api/profile/photo")).toBe(false);
  expect(screen.getByRole("button", { name: "Profile settings" }).querySelector("img").src).toBe(account.avatar_url);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByAltText("Selected photo preview")).toBeNull();
  expect(screen.getAllByAltText("Profile photo").every((img) => img.src === account.avatar_url)).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:selected-photo");
});

it("uploads the crop shown in the preview only after Save photo", async () => {
  const { calls } = setup("user", (url, options, account) => {
    if (url === "/api/profile/photo") {
      account.avatar_path = "owner-id/crop.png";
      account.avatar_url = "https://example.test/crop.png";
      return ok({ id: account.id, avatar_path: account.avatar_path });
    }
  });
  open("/user/profile");
  fireEvent.change(await screen.findByLabelText("Choose profile photo"), { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
  const image = await screen.findByAltText("Selected photo preview");
  Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  fireEvent.load(image);
  fireEvent.change(screen.getByRole("slider", { name: "Zoom" }), { target: { value: "2" } });
  fireEvent.keyDown(screen.getByRole("group", { name: "Circular photo preview" }), { key: "ArrowLeft" });
  fireEvent.click(screen.getByRole("button", { name: "Save photo" }));
  await screen.findByText("Profile photo saved.");
  const context = HTMLCanvasElement.prototype.getContext.mock.results[0].value;
  expect(context.drawImage).toHaveBeenCalledWith(image, 262.5, 150, 300, 300, 0, 0, 512, 512);
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile/photo")).toHaveLength(1);
});

it("handles an unreadable image without uploading or replacing the saved photo", async () => {
  const { calls } = setup("user");
  open("/user/profile");
  fireEvent.change(await screen.findByLabelText("Choose profile photo"), { target: { files: [new File(["broken"], "photo.png", { type: "image/png" })] } });
  fireEvent.error(await screen.findByAltText("Selected photo preview"));
  await screen.findByText(/This photo could not be opened/);
  expect(screen.queryByRole("button", { name: "Save photo" })).toBeNull();
  expect(calls.mock.calls.some(([url]) => url === "/api/profile/photo")).toBe(false);
});

it("keeps a dragged photo within the circular preview", async () => {
  setup("user");
  vi.stubGlobal("PointerEvent", MouseEvent);
  open("/user/profile");
  fireEvent.change(await screen.findByLabelText("Choose profile photo"), { target: { files: [new File(["photo"], "photo.png", { type: "image/png" })] } });
  const image = await screen.findByAltText("Selected photo preview");
  Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } });
  fireEvent.load(image);
  const preview = screen.getByRole("group", { name: "Circular photo preview" });
  preview.setPointerCapture = vi.fn();
  vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({ width: 220 });
  fireEvent.pointerDown(preview, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(preview, { clientX: 1000, clientY: 1000 });
  expect(image.style.left).toBe("0%");
  expect(image.style.top).toBe("0%");
  fireEvent.pointerUp(preview);
  fireEvent.pointerMove(preview, { clientX: -1000, clientY: -1000 });
  expect(image.style.left).toBe("0%");
});

it.each(["user", "moderator", "admin"])("removes the %s saved photo and clears the settings and navbar avatars", async (role) => {
  const { calls, account } = setup(role, (url, options, saved) => {
    if (url === "/api/profile/photo" && options.method === "DELETE") {
      saved.avatar_path = null; saved.avatar_url = null;
      return ok({ id: saved.id, avatar_path: null });
    }
  });
  account.avatar_path = "owner-id/old.png"; account.avatar_url = "https://example.test/old.png";
  open(`/${role}/profile`);
  fireEvent.click(await screen.findByRole("button", { name: "Edit profile photo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove photo" }));
  await screen.findByText("Profile photo removed.");
  expect(screen.queryAllByAltText("Profile photo")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Profile settings" }).textContent).toBe("O");
  expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  expect(calls.mock.calls.filter(([url, options]) => url === "/api/profile/photo" && options.method === "DELETE")).toHaveLength(1);
});

it("reopens the saved photo for cropping and saves only when explicitly requested", async () => {
  const { calls, account } = setup("user", (url, options, saved) => {
    if (url === "/api/profile/photo" && options.method === "POST") {
      saved.avatar_path = "owner-id/recropped.png"; saved.avatar_url = "https://example.test/recropped.png";
      return ok({ id: saved.id, avatar_path: saved.avatar_path });
    }
  });
  account.avatar_path = "owner-id/old.png"; account.avatar_url = "https://example.test/old.png";
  open("/user/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Edit profile photo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Adjust photo" }));
  const preview = await screen.findByAltText("Selected photo preview");
  expect(preview.src).toBe(account.avatar_url);
  expect(preview.crossOrigin).toBe("anonymous");
  expect(calls.mock.calls.some(([url]) => url === "/api/profile/photo")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getAllByAltText("Profile photo").every(img => img.src === account.avatar_url)).toBe(true);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Edit profile photo" }));
  fireEvent.click(screen.getByRole("button", { name: "Adjust photo" }));
  await previewAndSave();
  await screen.findByText("Profile photo saved.");
  expect(screen.getAllByAltText("Profile photo").every(img => img.src === "https://example.test/recropped.png")).toBe(true);
});

it("preserves a photo on rejected removal and reloads an uncertain removal without repeating it", async () => {
  let uncertain = false;
  const { calls, account } = setup("user", (url, options, saved) => {
    if (url === "/api/profile/photo" && options.method === "DELETE") {
      if (!uncertain) return failure();
      saved.avatar_path = null; saved.avatar_url = null;
      throw new TypeError("Lost response");
    }
  });
  account.avatar_path = "owner-id/old.png"; account.avatar_url = "https://example.test/old.png";
  open("/user/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Edit profile photo" }));
  fireEvent.click(await screen.findByRole("button", { name: "Remove photo" }));
  await screen.findByText("Profile save failed.");
  expect(screen.getAllByAltText("Profile photo")).toHaveLength(2);
  uncertain = true;
  fireEvent.click(await screen.findByRole("button", { name: "Edit profile photo" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  await screen.findByText(/We could not confirm the photo change/);
  expect(screen.getByRole("button", { name: "Edit profile photo" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload saved profile" }));
  await screen.findByText("Saved profile reloaded.");
  expect(screen.queryAllByAltText("Profile photo")).toHaveLength(0);
  expect(calls.mock.calls.filter(([url]) => url === "/api/profile/photo")).toHaveLength(2);
});

it("keeps photo settings usable when background cleanup fails", async () => {
  const { calls } = setup("user", (url) => url === "/api/profile/photo/cleanup" ? failure(503) : undefined);
  open("/user/profile");
  await screen.findByRole("button", { name: "Edit profile photo" });
  await waitFor(() => expect(calls.mock.calls.some(([url]) => url === "/api/profile/photo/cleanup")).toBe(true));
  expect(screen.getByRole("button", { name: "Edit profile photo" }).disabled).toBe(false);
  expect(screen.queryByText("Profile save failed.")).toBeNull();
});


it("opens photo actions from the picture and dismisses them with Escape, outside clicks, or focus leaving", async () => {
  const { account } = setup("user");
  account.avatar_path = "owner-id/old.png"; account.avatar_url = "https://example.test/old.png";
  open("/user/profile");
  const trigger = await screen.findByRole("button", { name: "Edit profile photo" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Choose photo" })).toBeNull();
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const choose = screen.getByRole("button", { name: "Choose photo" });
  expect(screen.getByRole("button", { name: "Adjust photo" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remove photo" })).toBeTruthy();
  choose.focus();
  fireEvent.keyDown(choose, { key: "Escape" });
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("group", { name: "Photo actions" })).toBeNull();
  fireEvent.click(trigger);
  fireEvent.blur(trigger, { relatedTarget: document.body });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("offers only choosing a photo for an empty avatar and closes the dropdown when choosing", async () => {
  setup("user");
  open("/user/profile");
  fireEvent.click(await screen.findByRole("button", { name: "Edit profile photo" }));
  expect(screen.queryByRole("button", { name: "Adjust photo" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Remove photo" })).toBeNull();
  const input = screen.getByLabelText("Choose profile photo");
  const click = vi.spyOn(input, "click");
  fireEvent.click(screen.getByRole("button", { name: "Choose photo" }));
  expect(click).toHaveBeenCalledOnce();
  expect(screen.queryByRole("group", { name: "Photo actions" })).toBeNull();
});

it.each(["user", "moderator", "admin"])("persists three independent notification preferences for %s", async (role) => {
  const saved = { submission_updates: true, trace_comments: true, new_tides: true };
  setup(role, (url, options) => {
    if (url !== "/api/notification-preferences") return;
    if (options.method === "PATCH") {
      const { key, enabled } = JSON.parse(options.body);
      saved[key] = enabled;
    }
    return ok({ ...saved });
  });
  const view = open(`/${role}/profile`);
  fireEvent.click(await screen.findByRole("button", { name: /App settings/ }));
  const submission = await screen.findByRole("switch", { name: "Submission updates" });
  await waitFor(() => expect(submission.disabled).toBe(false));
  fireEvent.click(submission);
  await screen.findByText("Submission updates off. Saved to your account.");
  expect(submission.getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("switch", { name: "Comments on my traces" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("switch", { name: "New Tides" }));
  await screen.findByText("New Tides off. Saved to your account.");
  view.unmount();
  open(`/${role}/profile`);
  fireEvent.click(await screen.findByRole("button", { name: /App settings/ }));
  await waitFor(() => expect(screen.getByRole("switch", { name: "New Tides" }).disabled).toBe(false));
  expect(screen.getByRole("switch", { name: "New Tides" }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("switch", { name: "Submission updates" }).getAttribute("aria-checked")).toBe("false");
});

it("reloads notification preferences after an uncertain save without repeating the write", async () => {
  const saved = { submission_updates: true, trace_comments: true, new_tides: true };
  const { calls } = setup("user", (url, options) => {
    if (url !== "/api/notification-preferences") return;
    if (options.method === "PATCH") { saved.new_tides = false; throw new TypeError("Lost response"); }
    return ok({ ...saved });
  });
  open("/user/profile");
  fireEvent.click(await screen.findByRole("button", { name: /App settings/ }));
  await waitFor(() => expect(screen.getByRole("switch", { name: "New Tides" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("switch", { name: "New Tides" }));
  await screen.findByText(/Reload preferences to check/);
  expect(screen.getByRole("switch", { name: "New Tides" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Reload preferences" }));
  await waitFor(() => expect(screen.getByRole("switch", { name: "New Tides" }).disabled).toBe(false));
  expect(screen.getByRole("switch", { name: "New Tides" }).getAttribute("aria-checked")).toBe("false");
  expect(calls.mock.calls.filter(([url, options]) => url === "/api/notification-preferences" && options.method === "PATCH")).toHaveLength(1);
});
