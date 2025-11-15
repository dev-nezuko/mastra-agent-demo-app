import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createApp, type AgentRegistry } from "./app.ts";
import type { AddressInfo } from "node:net";

async function withApp(registry: AgentRegistry, run: (url: string) => Promise<void>) {
 const server = createApp(registry).listen(0, "127.0.0.1");
 await new Promise<void>(resolve => server.once("listening", resolve));
 try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
 finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
}
test("validates before calling the model and returns bounded context responses", async()=>{
 const calls: string[]=[];
 const registry: AgentRegistry={getAgent:()=>({generate:async prompt=>{calls.push(prompt);return {text:"Synthetic answer"};}})};
 await withApp(registry,async url=>{
  for (const question of ["", 12, "x".repeat(2001)]) {
   const response=await fetch(url+"/api/question",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question})});
   assert.equal(response.status,400);
  }
  assert.equal(calls.length,0);
  const response=await fetch(url+"/api/question",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"  Example question  "})});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{question:"Example question",text:"Synthetic answer"});assert.deepEqual(calls,["Example question"]);
 });
});
test("weather rejects repeated cities and marks model output simulated",async()=>{
 await withApp({getAgent:()=>({generate:async()=>({text:"Synthetic weather"})})},async url=>{
  assert.equal((await fetch(url+"/api/weather?city=A&city=B")).status,400);
  const response=await fetch(url+"/api/weather?city=London");assert.equal((await response.json() as any).simulated,true);
 });
});
test("provider errors stay generic and request bodies have a size limit",async()=>{
 await withApp({getAgent:()=>({generate:async()=>{throw new Error("private synthetic provider detail")}})},async url=>{
  const response=await fetch(url+"/api/question",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"Example"})});assert.equal(response.status,502);assert.equal((await response.text()).includes("private synthetic"),false);
  const large=await fetch(url+"/api/question",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:"x".repeat(20000)})});assert.equal(large.status,413);
 });
});
