import test from "node:test";
import assert from "node:assert/strict";
import { detectRepairFaults, normalized, researchRepair } from "../lib/repair-ai.ts";

test("fault normalization handles accents and multilingual battery reports",()=>{
  assert.equal(normalized("BATERÍA não aguenta carga"),"bateria nao aguenta carga");
  assert.equal(detectRepairFaults("A bateria não aguenta carga")[0].key,"battery");
});

test("AI quote ranges remain ordered without verified live prices",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response("",{status:404});
  try{
    const result=await researchRepair({device:"Unknown device",issue:"intermittent strange fault",category:"Other",laborRate:38});
    assert.ok(result.quoteLow<=result.quoteRecommended);
    assert.ok(result.quoteRecommended<=result.quoteHigh);
    assert.equal(result.confidence,"Low");
    assert.equal(result.status,"review");
  }finally{globalThis.fetch=originalFetch;}
});
