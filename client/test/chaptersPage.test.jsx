import React, { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";

const id = "50000000-0000-4000-8000-000000000001";
const imageId = "0a1b2c3d-0000-4000-8000-00000000abcd";
const ok = (data) => ({ ok: true, status: 200, json: async () => ({ data }) });
const body = `Welcome to the lesson.\n\n## First chapter\nText of the first chapter.\n\n![A shore at low tide](image:${imageId})\n\n## Second chapter\nText of the second chapter.\n\n## Third chapter\nText of the third chapter.`;
const lesson = (extra = {}) => ({ id, title: "Reading the shoreline", slug: "reading-the-shoreline", body, status: "published", published_at: "2026-10-01T00:00:00Z", paged: true, slides_path: null, ...extra });

function setup({ tide = lesson(), images = [{ id: imageId, alt: "A shore at low tide", url: "https://files.example.test/a.png?token=t" }] } = {}, path = `/user/tides/${id}`) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now() / 1000 + 3600 }));
  const calls = vi.fn(async (url) => {
    if (url === "/api/auth/me") return ok({ id: "me", display_name: "Member", role: "user", status: "active" });
    if (url === `/api/tides/${id}`) return ok(tide);
    if (url === `/api/tides/${id}/images`) return ok(images);
    if (url === `/api/tides/${id}/neighbors`) return ok({ id, previous: null, next: null });
    return ok([]);
  });
  vi.stubGlobal("fetch", calls);
  render(<StrictMode><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></StrictMode>);
  return calls;
}
beforeEach(() => { sessionStorage.clear(); });

it("shows one chapter at a time with a contents list, and moves with Previous and Next", async () => {
  setup();
  const article = await screen.findByRole("article", { name: "Lesson content" });
  expect(within(article).getByText("Chapter 1 of 4: Introduction")).toBeTruthy();
  expect(within(article).getByText("Welcome to the lesson.")).toBeTruthy();
  expect(within(article).queryByText("Text of the first chapter.")).toBeNull();
  expect(within(article).getByRole("button", { name: "Previous chapter" }).disabled).toBe(true);
  fireEvent.click(within(article).getByRole("button", { name: "Next chapter" }));
  await within(article).findByText("Chapter 2 of 4: First chapter");
  expect(within(article).getByRole("heading", { level: 3, name: "First chapter" })).toBeTruthy();
  expect(within(article).queryByText("Welcome to the lesson.")).toBeNull();
  const contents = within(article).getByRole("navigation", { name: "Chapters" });
  expect(within(contents).getAllByRole("button").map((button) => button.textContent)).toEqual(["Introduction", "First chapter", "Second chapter", "Third chapter"]);
  expect(within(contents).getByRole("button", { name: "First chapter" }).getAttribute("aria-current")).toBe("step");
  fireEvent.click(within(contents).getByRole("button", { name: "Third chapter" }));
  await within(article).findByText("Chapter 4 of 4: Third chapter");
  expect(within(article).getByRole("button", { name: "Next chapter" }).disabled).toBe(true);
});

it("keeps the chapter in the address so a reload or a link opens the same chapter, and clamps a bad number", async () => {
  setup({}, `/user/tides/${id}?part=3`);
  const article = await screen.findByRole("article", { name: "Lesson content" });
  expect(within(article).getByText("Chapter 3 of 4: Second chapter")).toBeTruthy();
  expect(within(article).getByText("Text of the second chapter.")).toBeTruthy();
  cleanup();
  setup({}, `/user/tides/${id}?part=99`);
  expect(await screen.findByText("Chapter 4 of 4: Third chapter")).toBeTruthy();
});

it("shows the images inside a chapter, with the description if the image cannot load", async () => {
  setup({}, `/user/tides/${id}?part=2`);
  const picture = await screen.findByRole("img", { name: "A shore at low tide" });
  expect(picture.getAttribute("src")).toBe("https://files.example.test/a.png?token=t");
  expect(picture.getAttribute("loading")).toBe("lazy");
  fireEvent.error(picture);
  expect(await screen.findByText("Image not available: A shore at low tide")).toBeTruthy();
});

it("shows the description when an image has no link", async () => {
  setup({ images: [{ id: imageId, alt: "A shore at low tide", url: null }] }, `/user/tides/${id}?part=2`);
  expect(await screen.findByText("Image not available: A shore at low tide")).toBeTruthy();
});

it("offers Mark as complete only on the last chapter, and makes the top bar follow the chapters", async () => {
  setup();
  const article = await screen.findByRole("article", { name: "Lesson content" });
  const bar = () => document.querySelector(".reading-progress span").style.transform;
  expect(screen.queryByRole("button", { name: "Mark as complete" })).toBeNull();
  await waitFor(() => expect(bar()).toBe("scaleX(0.25)"));
  fireEvent.click(within(article).getByRole("button", { name: "Next chapter" }));
  await waitFor(() => expect(bar()).toBe("scaleX(0.5)"));
  fireEvent.click(within(article).getByRole("button", { name: "Next chapter" }));
  fireEvent.click(within(article).getByRole("button", { name: "Next chapter" }));
  await within(article).findByText("Chapter 4 of 4: Third chapter");
  expect(await screen.findByRole("button", { name: "Mark as complete" })).toBeTruthy();
  await waitFor(() => expect(bar()).toBe("scaleX(1)"));
});

it("shows a lesson in one piece when chapters are off, or there is only one section, or it has slides", async () => {
  setup({ tide: lesson({ paged: false }) });
  const article = await screen.findByRole("article", { name: "Lesson content" });
  expect(within(article).getByText("Text of the first chapter.")).toBeTruthy();
  expect(within(article).getByText("Text of the third chapter.")).toBeTruthy();
  expect(within(article).queryByRole("button", { name: "Next chapter" })).toBeNull();
  expect(screen.getByRole("button", { name: "Mark as complete" })).toBeTruthy();
});

it("does not split a lesson that has fewer than two sections", async () => {
  setup({ tide: lesson({ body: "## Only section\nSome text." }), images: [] });
  const article = await screen.findByRole("article", { name: "Lesson content" });
  expect(within(article).getByText("Some text.")).toBeTruthy();
  expect(within(article).queryByRole("button", { name: "Next chapter" })).toBeNull();
});

it("only asks for images when the text uses some", async () => {
  const calls = setup({ tide: lesson({ body: "## A\ntext\n\n## B\ntext" }) });
  await screen.findByRole("article", { name: "Lesson content" });
  expect(calls.mock.calls.some(([url]) => String(url).endsWith("/images"))).toBe(false);
});
