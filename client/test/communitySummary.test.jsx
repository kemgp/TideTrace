import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "./router.jsx";
import { it, expect, vi } from "vitest";
import App from "../src/App.jsx";
const data={id:"community",published_traces:12,contributors:4,published_tides:3,tides_completed:27,as_of:"2026-10-10T00:00:00Z"};
const ok=data=>({ok:true,status:200,json:async()=>({data})});
const open=()=>render(<MemoryRouter initialEntries={["/"]}><App/></MemoryRouter>);
it("shows anonymous live counts only in the community section",async()=>{
 const calls=vi.fn(async()=>ok(data));vi.stubGlobal("fetch",calls);open();
 expect(await screen.findAllByText("27",{exact:true})).toHaveLength(1);
 expect(screen.getAllByText("12",{exact:true})).toHaveLength(1);
 expect(calls).toHaveBeenCalledTimes(1);
 expect(calls.mock.calls[0][0]).toBe("/api/community-summary");
 expect(calls.mock.calls[0][1].headers.Authorization).toBeUndefined();
 expect(screen.queryByText("Real-time impact")).toBeNull();
 expect(screen.queryByText("3.2t")).toBeNull();expect(screen.queryByText("640")).toBeNull();
});
it("uses skeletons while pending and preserves real zero counts",async()=>{
 let finish;vi.stubGlobal("fetch",()=>new Promise(resolve=>{finish=resolve;}));open();
 expect(screen.getAllByLabelText("Loading total")).toHaveLength(4);
 expect(screen.queryByText("0",{exact:true})).toBeNull();
 await act(async()=>finish(ok({...data,published_traces:0,contributors:0,published_tides:0,tides_completed:0})));
 expect(screen.getAllByText("0",{exact:true})).toHaveLength(4);
});
it("shows an error and retry instead of fake totals",async()=>{
 let fail=true;vi.stubGlobal("fetch",async()=>ok(fail?{...data,contributors:99}:data));open();
 await screen.findByRole("alert");expect(screen.getAllByText("—")).toHaveLength(4);
 fail=false;fireEvent.click(screen.getByRole("button",{name:"Retry community totals"}));
 expect(await screen.findAllByText("27",{exact:true})).toHaveLength(1);
});
