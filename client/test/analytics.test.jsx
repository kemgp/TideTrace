import React from "react";
import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
const summary = { id:"staff",role:"admin",as_of:"2026-10-05T00:00:00Z",traces:0,approved:0,pending:0,rejected:0,needs_revision:0,comments:0,completions:0,my_reviews:0,my_report_decisions:0,categories:[],users:0,active_users:0,reviewers:[] };
const ok = data => ({ok:true,status:200,json:async()=>({data})});
function setup(role="admin", handler=()=>ok({...summary,role})) {
 sessionStorage.setItem(SESSION_KEY,JSON.stringify({access_token:"access",refresh_token:"refresh",expires_at:Date.now()/1000+3600}));
 const fetcher=vi.fn(async url=>url==="/api/auth/me"?ok({id:"staff",role,status:"active"}):url==="/api/moderation/analytics"?handler():ok([]));
 vi.stubGlobal("fetch",fetcher);
 render(<MemoryRouter initialEntries={[`/${role}/analytics`]}><App/></MemoryRouter>);
 return fetcher;
}
it.each(["admin","moderator"])("renders actual zero counts for %s without demo data",async role=>{
 setup(role);
 await screen.findByText("My moderation activity");
 expect(screen.getAllByText("0").length).toBeGreaterThan(3);
 expect(screen.queryByText(/Demo analytics/)).toBeNull();
 expect(Boolean(screen.queryByText("Staff activity · trace reviews"))).toBe(role==="admin");
});
it("keeps a page-specific skeleton until analytics resolves",async()=>{
 let finish; const pending=new Promise(resolve=>{finish=resolve;});
 setup("admin",()=>pending);
 const loader=await screen.findByRole("status",{name:"Loading content"});
 expect(loader.dataset.skeletonType).toBe("analytics");
 finish(ok(summary));
 await screen.findByText("My moderation activity");
});
it("rejects another account's summary and allows refresh",async()=>{
 let wrong=true;setup("admin",()=>ok({...summary,id:wrong?"other":"staff"}));
 await screen.findByRole("alert");
 expect(screen.queryByText("My moderation activity")).toBeNull();
 wrong=false;fireEvent.click(screen.getByRole("button",{name:"Try again"}));
 await screen.findByText("My moderation activity");
});
it("shows API errors rather than invented totals",async()=>{
 setup("admin",()=>({ok:false,status:503,json:async()=>({error:{message:"Unavailable",code:"FAILED"}})}));
 await screen.findByRole("alert");expect(screen.queryByText("total accounts")).toBeNull();
});
