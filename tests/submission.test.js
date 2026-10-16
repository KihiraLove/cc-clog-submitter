import test from "node:test";
import assert from "node:assert/strict";
import {
  EXTRA_WORLD_TYPES,BLOCKED_WORLD_TYPES,COOKIE_NAME,worldFlags,
  normalizeEndpoint,itemOptions,encodeClanKey,readCookieSettings,writeCookieSettings,submissionKey,
  createSubmissionBody,effectiveChatMessage
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

test("idempotency is random per submission by default and reused only while checked",()=>{
  let counter=0;
  const generate=()=>`uuid-${++counter}`;
  let lastKey=submissionKey(null,false,generate);
  assert.equal(lastKey,"uuid-1");
  lastKey=submissionKey(lastKey,false,generate);
  assert.equal(lastKey,"uuid-2");
  lastKey=submissionKey(lastKey,true,generate);
  assert.equal(lastKey,"uuid-2");
  lastKey=submissionKey(lastKey,true,generate);
  assert.equal(lastKey,"uuid-2");
  // Unchecking resets lastKey in the event handler; subsequent submissions get a new UUID.
  lastKey=null;
  lastKey=submissionKey(lastKey,false,generate);
  assert.equal(lastKey,"uuid-3");
});
test("requested copy removed and item picker uses accessible result buttons",async()=>{
  const {readFile}=await import("node:fs/promises");
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  const app=await readFile(new URL("../src/app.js",import.meta.url),"utf8");
  for(const forbidden of [
    "Test your RuneLite collection-log submission API with a sample item and screenshot.",
    "The API key stays in this tab; other settings are saved in a cookie.",
    "HTTPS base URL or full /api/v1/runelite/submissions URL",
    "Leave blank only if the server has disabled key enforcement. Never saved in cookies.",
    "Fields sent to the API as multipart/form-data.",
    "Retained after failed requests for safe retries.",
    "Static frontend · Sends requests only to your configured endpoint · Key stays in memory",
    "github.com/KihiraLove/",'id="item-count"','id="item-id"',"screenshot-preview",
    'id="idempotency-key"','id="new-key"'
  ])assert.ok(!html.includes(forbidden),forbidden);
  assert.match(html,/id="item-results"/u);
  assert.match(html,/id="keep-idempotency-key" type="checkbox"/u);
  assert.match(html,/Don't regenerate idempotency key \(only check this if you know what you're doing\)/u);
  assert.match(app,/button\.setAttribute\("aria-pressed"/u);
  assert.match(app,/createSubmissionBody\(\{\.\.\.chosen,worldTypes:flags\},screenshotFile\)/u);
});

test("compact form has a one-line heading and a single world flag row",async()=>{
  const {readFile}=await import("node:fs/promises");
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  const css=await readFile(new URL("../styles.css",import.meta.url),"utf8");
  const app=await readFile(new URL("../src/app.js",import.meta.url),"utf8");
  assert.ok(!html.includes("OSRS · INTERNAL API TEST TOOL"));
  assert.match(html,/<h1>Collection Log <span>Submission Tester<\/span><\/h1>/u);
  assert.match(css,/white-space:\s*nowrap/u);
  assert.match(html,/<fieldset class="world-flags"><legend>Worlds flags<\/legend><div class="world-controls">/u);
  assert.ok(!html.includes("<legend>World membership</legend>"));
  assert.ok(!html.includes(">Additional world type<"));
  assert.match(html,/<select id="world-type" aria-label="Additional world flag">/u);
  assert.match(css,/grid-auto-rows:\s*32px/u);
  assert.match(css,/max-height:\s*154px/u);
  assert.match(css,/align-items:\s*center/u);
  assert.match(css,/input:not\(\[type="radio"\]\):not\(\[type="checkbox"\]\)/u);
  assert.match(app,/button\.title=button\.textContent/u);
  assert.match(app,/createSubmissionBody\(\{\.\.\.chosen,worldTypes:flags\},screenshotFile\)/u);
});

test("chat message sends dummy text when empty or whitespace",()=>{
  assert.equal(effectiveChatMessage(""),"dummy text");
  assert.equal(effectiveChatMessage("   \t"),"dummy text");
  assert.equal(effectiveChatMessage("Drop received"),"Drop received");
});
test("multipart always includes chatMessage and optionally the screenshot",()=>{
  const fields={username:"Collector",clanName:"Clan",itemId:"4151",worldTypes:["MEMBERS"],chatMessage:""};
  const plain=createSubmissionBody(fields);
  assert.deepEqual([...plain.keys()],["username","clanName","itemId","worldType","chatMessage"]);
  assert.equal(plain.get("chatMessage"),"dummy text");
  assert.equal(plain.has("screenshot"),false);
  const screenshot=new Blob([new Uint8Array([137,80,78,71])],{type:"image/png"});
  const withFile=createSubmissionBody({...fields,chatMessage:"An item!"},screenshot);
  assert.equal(withFile.get("chatMessage"),"An item!");
  assert.equal(withFile.get("screenshot").name,"dummy-submission.png");
  assert.equal(withFile.get("screenshot").type,"image/png");
});
test("screenshot preference defaults to included and can be disabled without saving API key",async()=>{
  const {readFile}=await import("node:fs/promises");
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  const app=await readFile(new URL("../src/app.js",import.meta.url),"utf8");
  assert.match(html,/<input id="chat-message" type="text" placeholder="dummy text"/u);
  assert.match(html,/<input id="include-screenshot" type="checkbox" checked>/u);
  assert.match(app,/includeScreenshot\.checked\?await sampleScreenshot\(\):null/u);
  assert.match(app,/includeScreenshot\.checked=saved\.includeScreenshot!=="false"/u);
  const cookie=writeCookieSettings({chatMessage:"Hello",includeScreenshot:"false",apiKey:"NEVER_STORE"},"/cc-clog-submitter/");
  assert.ok(!cookie.includes("NEVER_STORE"));
  assert.deepEqual(readCookieSettings(cookie.split(";")[0]),{chatMessage:"Hello",includeScreenshot:"false"});
});

test("dummy screenshot label and background cover the full viewport",async()=>{
  const {readFile}=await import("node:fs/promises");
  const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
  const css=await readFile(new URL("../styles.css",import.meta.url),"utf8");
  assert.match(html,/<span>Include dummy screenshot<\/span>/u);
  assert.ok(!html.includes("<span>Include screenshot</span>"));
  assert.match(css,/min-height:\s*100vh/u);
  assert.match(css,/background-attachment:\s*fixed/u);
});
