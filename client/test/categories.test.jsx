import React from "react";
import { it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
const id = "90000000-0000-4000-8000-000000000001";
const initial = { id, name: "Coral", description: null, is_active: true, updated_at: "2026-10-01T00:00:00Z" };
const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) });
function setup(failure) {
 let row = { ...initial };
 sessionStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_at: Date.now()/1000+3600 }));
 const calls = vi.fn(async (url, options) => {
  if (url === "/api/auth/me") return ok({ id: "admin", role: "admin", status: "active" });
  if (options.method === "PUT" || options.method === "POST") {
   if (failure) return { ok: false, status: 409, json: async () => ({ error: { code: failure, message: "Conflict" } }) };
   row = { ...row, ...JSON.parse(options.body) }; return ok(row);
  }
  return ok([row]);
 });
 vi.stubGlobal("fetch", calls);
 render(<MemoryRouter initialEntries={["/admin/categories"]}><App /></MemoryRouter>);
 return calls;
}
it("renames, deactivates and reactivates saved categories", async () => {
 const calls = setup();
 let form = await screen.findByRole("form", { name: "Edit category Coral" });
 fireEvent.change(within(form).getByLabelText("Category name"), { target: { value: "Reef" } });
 fireEvent.click(within(form).getByLabelText("Active category"));
 fireEvent.click(within(form).getByRole("button", { name: "Save category" }));
 form = await screen.findByRole("form", { name: "Edit category Reef" });
 expect(within(form).getByText("Inactive")).toBeTruthy();
 const write = calls.mock.calls.find(([, o]) => o.method === "PUT");
 expect(JSON.parse(write[1].body)).toMatchObject({ name: "Reef", is_active: false, updated_at: initial.updated_at });
 fireEvent.click(within(form).getByLabelText("Active category"));
 fireEvent.click(within(form).getByRole("button", { name: "Save category" }));
 await screen.findByText("Active", { exact: true });
 expect(calls.mock.calls.some(([, o]) => o.method === "DELETE")).toBe(false);
});
it("validates and creates a saved category", async () => {
 const calls = setup();
 const form = await screen.findByRole("form", { name: "Create category" });
 fireEvent.click(within(form).getByRole("button", { name: "Add category" }));
 await screen.findByText("Enter a category name.");
 fireEvent.change(within(form).getByLabelText("New category name"), { target: { value: " Mangroves " } });
 fireEvent.click(within(form).getByRole("button", { name: "Add category" }));
 await screen.findByRole("form", { name: "Edit category Mangroves" });
 expect(JSON.parse(calls.mock.calls.find(([, o]) => o.method === "POST")[1].body).name).toBe("Mangroves");
});
it.each(["STALE_VERSION", "ALREADY_EXISTS"])("shows %s errors without claiming success", async code => {
 setup(code);
 const form = await screen.findByRole("form", { name: "Edit category Coral" });
 fireEvent.click(within(form).getByRole("button", { name: "Save category" }));
 await screen.findByRole("alert");
 expect(screen.queryByText("Category saved.")).toBeNull();
 expect(form.querySelector("fieldset").disabled).toBe(code === "STALE_VERSION");
});
