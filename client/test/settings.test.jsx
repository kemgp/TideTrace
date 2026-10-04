import React from "react";
import { it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { SESSION_KEY } from "../src/api/session.js";
const ok=data=>({ok:true,status:200,json:async()=>({data})});
function setup(fail=false){
 let saved={id:"workflow",value:{submissions_paused:false,max_media_per_trace:10},updated_at:null};
 sessionStorage.setItem(SESSION_KEY,JSON.stringify({access_token:"access",refresh_token:"refresh",expires_at:Date.now()/1000+3600}));
 const calls=vi.fn(async(url,options)=>{
  if(url==="/api/auth/me")return ok({id:"admin",role:"admin",status:"active"});
  if(url==="/api/admin/workflow-settings"){
   if(options.method==="PUT"){
    if(fail)return {ok:false,status:409,json:async()=>({error:{code:"STALE_VERSION",message:"Changed"}})};
    saved={...saved,...JSON.parse(options.body),updated_at:"2026-10-05T00:00:00Z"};
   }
   return ok(saved);
  }
  return ok([]);
 });
 vi.stubGlobal("fetch",calls);
 render(<MemoryRouter initialEntries={["/admin/settings?tab=app"]}><App/></MemoryRouter>);
 return calls;
}
it("saves actual settings and reloads their stored values",async()=>{
 const calls=setup();
 fireEvent.click(await screen.findByRole("switch",{name:"Pause Trace submissions"}));
 fireEvent.change(screen.getByLabelText("Maximum media per Trace"),{target:{value:"3"}});
 fireEvent.click(screen.getByRole("button",{name:"Save settings"}));
 await screen.findByText("Settings saved.");
 expect(JSON.parse(calls.mock.calls.find(([,o])=>o.method==="PUT")[1].body)).toEqual({value:{submissions_paused:true,max_media_per_trace:3},updated_at:null});
 fireEvent.click(screen.getByRole("button",{name:"Reload saved settings"}));
 expect((await screen.findByRole("switch",{name:"Pause Trace submissions"})).getAttribute("aria-checked")).toBe("true");
 expect(screen.getByLabelText("Maximum media per Trace").value).toBe("3");
});
it("requires reload after a conflicting save",async()=>{
 const calls=setup(true);
 await screen.findByRole("switch");
 fireEvent.click(screen.getByRole("button",{name:"Save settings"}));
 await screen.findByRole("alert");
 expect(screen.queryByText("Settings saved.")).toBeNull();
 expect(screen.getByRole("button",{name:"Save settings"}).closest("fieldset").disabled).toBe(true);
 expect(calls.mock.calls.filter(([,o])=>o.method==="PUT")).toHaveLength(1);
});
