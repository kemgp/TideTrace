import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useApp } from "../src/context/AppContext.jsx";
import TracePhotos from "../src/components/TracePhotos.jsx";
import TraceCard from "../src/components/TraceCard.jsx";
import { compressPhoto } from "../src/api/compressPhoto.js";
vi.mock("../src/context/AppContext.jsx", () => ({ useApp: vi.fn() }));

it("does not request evidence URLs until each photo or video is explicitly loaded", async () => {
  const readData = vi.fn(async () => ({ url: "https://example.test/media" }));
  useApp.mockReturnValue({ profile: { id: "viewer", data_saver: true }, readData });
  const trace = { id: "trace", trace_media: [{ id: "photo", mime_type: "image/jpeg", sort_order: 0 }, { id: "video", mime_type: "video/mp4", sort_order: 1 }] };
  render(<TracePhotos trace={trace} />);
  expect(readData).not.toHaveBeenCalled();
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Load photo 1" }));
  await screen.findByRole("img", { name: "Trace photo 1" });
  expect(readData).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Load video 2" }));
  const video = await screen.findByLabelText("Trace video 2");
  expect(video.preload).toBe("none");
  expect(video.autoplay).toBe(false);
  expect(readData).toHaveBeenCalledTimes(2);
});

it("defers archive thumbnails without blocking Trace navigation", async () => {
  const readData = vi.fn(async () => ({ url: "https://example.test/photo" }));
  useApp.mockReturnValue({ profile: { id: "viewer", data_saver: true }, readData });
  render(<MemoryRouter><TraceCard trace={{ id: "trace", title: "Coast", author: "Member", trace_media: [{ id: "photo", mime_type: "image/jpeg" }] }} to="/user/traces/trace" /></MemoryRouter>);
  expect(readData).not.toHaveBeenCalled();
  expect(screen.getByRole("link").getAttribute("href")).toBe("/user/traces/trace");
  fireEvent.click(screen.getByRole("button", { name: "Load photo" }));
  await screen.findByAltText("Coast photo");
  expect(readData).toHaveBeenCalledTimes(1);
});

function imageMocks(blobSize = 10) {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("Image", class { naturalWidth = 4000; naturalHeight = 3000; set src(value) { queueMicrotask(() => this.onload()); } });
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function(done) {
    expect(this.width).toBe(1600); expect(this.height).toBe(1200);
    done(new Blob(["a".repeat(blobSize)], { type: "image/webp" }));
  });
  return draw;
}
it("reduces dimensions and upload bytes while retaining the previewable processed file", async () => {
  imageMocks();
  const file = new File(["x".repeat(100)], "coast.jpg", { type: "image/jpeg" });
  const prepared = await compressPhoto(file);
  expect(prepared.name).toBe("coast.webp");
  expect(prepared.type).toBe("image/webp");
  expect(prepared.size).toBeLessThan(file.size);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo");
});
it("keeps the original when recompression would increase upload size", async () => {
  imageMocks(200);
  const file = new File(["x".repeat(100)], "coast.jpg", { type: "image/jpeg" });
  expect(await compressPhoto(file)).toBe(file);
});
it("does not silently upload an unprocessed file when decoding fails", async () => {
  imageMocks();
  vi.stubGlobal("Image", class { set src(value) { queueMicrotask(() => this.onerror()); } });
  await expect(compressPhoto(new File(["photo"], "broken.png", { type: "image/png" }))).rejects.toThrow("could not be opened");
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it.each(["Save draft", "Submit Trace"])("prepares the preview before %s sends the same compressed file to upload", async (action) => {
  imageMocks();
  const { default: TraceDraftForm } = await import("../src/components/TraceDraftForm.jsx");
  const category = { id: "category", name: "Seagrass" };
  let saved;
  const media = { id: "media", trace_id: "trace", mime_type: "image/webp" };
  const writeData = vi.fn(async (path, options) => {
    if (path === "traces") return saved = { ...options.body, id: "trace", author_id: "viewer", status: "draft", version: 1 };
    if (path.endsWith("/media")) return media;
    if (path.endsWith("/submit")) return { ...saved, status: "pending", version: 2 };
  });
  const readData = vi.fn(async path => path === "categories" ? [category] : { ...saved, trace_media: [media] });
  useApp.mockReturnValue({ profile: { id: "viewer", data_saver: true }, readData, writeData, showToast: vi.fn() });
  render(<MemoryRouter><TraceDraftForm /></MemoryRouter>);
  await screen.findByRole("option", { name: "Seagrass" });
  fireEvent.change(screen.getByLabelText("Category (required)"), { target: { value: category.id } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Coast" } });
  fireEvent.change(screen.getByLabelText("Location"), { target: { value: "Shore" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Observation" } });
  fireEvent.change(screen.getByLabelText("Choose a photo (required for submission)"), { target: { files: [new File(["x".repeat(100)], "coast.jpg", { type: "image/jpeg" })] } });
  await screen.findByAltText("Selected photo preview");
  expect(writeData).not.toHaveBeenCalled();
  const processed = URL.createObjectURL.mock.calls.at(-1)[0];
  expect(processed.name).toBe("coast.webp");
  fireEvent.click(screen.getByRole("button", { name: action }));
  await waitFor(() => expect(writeData.mock.calls.some(([path]) => path.endsWith("/media"))).toBe(true));
  expect(writeData.mock.calls.find(([path]) => path.endsWith("/media"))[1].file).toBe(processed);
});

it.each(["picker", "drop"])("prepares a smaller preview when adding evidence to a saved draft via %s", async (source) => {
  imageMocks();
  useApp.mockReturnValue({ profile: { id: "viewer", data_saver: true }, readData: vi.fn(async () => []), writeData: vi.fn() });
  render(<MemoryRouter><TracePhotos contribution trace={{ id: "draft", author_id: "viewer", status: "draft", trace_media: [] }} /></MemoryRouter>);
  const files = [new File(["x".repeat(100)], "coast.jpg", { type: "image/jpeg" })];
  if (source === "drop") fireEvent.drop(screen.getByText("Drag and drop your photo here").parentElement, { dataTransfer: { files } });
  else fireEvent.change(screen.getByLabelText("Choose a photo"), { target: { files } });
  await screen.findByAltText("Selected photo preview");
  expect(URL.createObjectURL.mock.calls.at(-1)[0].name).toBe("coast.webp");
});
