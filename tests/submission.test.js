import test from "node:test";
import assert from "node:assert/strict";
import {
  EXTRA_WORLD_TYPES,BLOCKED_WORLD_TYPES,COOKIE_NAME,worldFlags,
  normalizeEndpoint,itemOptions,encodeClanKey,readCookieSettings,writeCookieSettings
} from "../src/submission.js";
test("14 supported extra world types and membership",()=>{
  assert.equal(EXTRA_WORLD_TYPES.length,14);
  assert.ok(EXTRA_WORLD_TYPES.includes("HARDCORE_MAIN"));
  assert.ok(BLOCKED_WORLD_TYPES.includes("DEADMAN"));
  assert.deepEqual(worldFlags("MEMBERS","PVP"),["MEMBERS","PVP"]);
  assert.deepEqual(worldFlags("F2P",""),["F2P"]);
  assert.throws(()=>worldFlags("PVP"));
});
test("HTTPS endpoint resolution",()=>{
  assert.equal(normalizeEndpoint("https://example.test"),"https://example.test/api/v1/runelite/submissions");
  assert.equal(normalizeEndpoint("https://example.test/api/v1"),"https://example.test/api/v1/runelite/submissions");
  assert.equal(normalizeEndpoint("https://example.test/api/v1/runelite/submissions"),"https://example.test/api/v1/runelite/submissions");
  for(const input of ["http://example.test","https://a.test/?key=secret","https://user:pass@a.test"])
    assert.throws(()=>normalizeEndpoint(input));
});
test("game-item IDs populate the catalogue",()=>{
  assert.deepEqual(itemOptions({items:{"6739":"Dragon axe","4151":"Abyssal whip","0":"Invalid"}}),
    [{id:"4151",name:"Abyssal whip"},{id:"6739",name:"Dragon axe"}]);
});
test("clan key encoded as UTF8 base64url",()=>{
  const input="árvíztűrő \n key";
  assert.equal(Buffer.from(encodeClanKey(input),"base64url").toString("utf8"),input);
});
test("cookie settings roundtrip strips any secret",()=>{
  const serialized=writeCookieSettings({endpoint:"https://a.test",username:"A",apiKey:"secret"},"/cc-clog-submitter/");
  assert.ok(!serialized.includes("secret"));
  assert.ok(serialized.includes("SameSite=Strict"));
  const value=serialized.split(";")[0];
  assert.deepEqual(readCookieSettings(value),{endpoint:"https://a.test",username:"A"});
  assert.deepEqual(readCookieSettings(COOKIE_NAME+"=%7Binvalid"),{});
});
