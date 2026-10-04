import { once } from "node:events";
import { createApp } from "../src/app.js";
import { readConfig } from "../src/config.js";
let server;
const check = (ok, message) => { if (!ok) throw new Error(message); };
try {
 const config = readConfig();
 check(config.configured, "Configure server/.env first.");
 const rpc = await fetch(`${config.url}/rest/v1/rpc/get_staff_analytics`, {
  method: "POST", headers: { apikey: config.key, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(20000),
 });
 const result = await rpc.json();
 check([401,403].includes(rpc.status) && result.code === "42501", `Analytics RPC installation/access check failed (HTTP ${rpc.status}, code ${result.code || "unknown"}).`);
 console.log("PASS: live analytics RPC exists and rejects anonymous access.");
 server = createApp({ config }).listen(0, "127.0.0.1"); await once(server,"listening");
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const anonymous=await fetch(`${base}/moderation/analytics`);
 check(anonymous.status===401,"Analytics API must require sign-in.");
 console.log("PASS: current API analytics route requires sign-in.");
 const token=process.env.TIDETRACE_VERIFY_ACCESS_TOKEN;
 if (!token) console.log("SKIP: authenticated live analytics (no verification session supplied).");
 else {
  const headers={Authorization:`Bearer ${token}`};
  const me=await fetch(`${base}/auth/me`,{headers}); const {data:profile}=await me.json();
  check(me.ok && profile?.id,"Verification session is invalid.");
  const response=await fetch(`${base}/moderation/analytics`,{headers}); const {data}=await response.json();
  if (profile.role==='user' || profile.status!=='active') check(response.status===403,"Non-staff access must be denied.");
  else {
   check(response.ok && data?.id===profile.id && data.role===profile.role,"Authenticated analytics failed.");
   check(['traces','approved','pending','rejected','needs_revision','comments','completions','my_reviews','my_report_decisions'].every(k=>Number.isSafeInteger(data[k])&&data[k]>=0),"Analytics count is invalid.");
   check(data.traces===data.approved+data.pending+data.rejected+data.needs_revision,"Status counts do not reconcile.");
   check(Array.isArray(data.categories)&&data.categories.reduce((total,row)=>total+row.value,0)===data.traces,"Category counts do not reconcile.");
   check(profile.role==='admin'?Array.isArray(data.reviewers):!Object.hasOwn(data,'reviewers'),"Reviewer visibility is incorrect.");
  }
  console.log("PASS: signed-in analytics permissions and aggregate consistency.");
 }
} catch(error) { console.error(`FAIL: ${error.message}`);process.exitCode=1; }
finally { if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));} }
