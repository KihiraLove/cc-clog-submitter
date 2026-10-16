/** Pure RuneLite submission helpers. */
export const EXTRA_WORLD_TYPES=Object.freeze([
  "PVP","HARDCORE_MAIN","BOUNTY","HIGH_RISK","BETA_WORLD","DEADMAN",
  "FRESH_START_WORLD","LAST_MAN_STANDING","NOSAVE_MODE","PVP_ARENA",
  "QUEST_SPEEDRUNNING","SEASONAL","SKILL_TOTAL","TOURNAMENT_WORLD"
]);
export const BLOCKED_WORLD_TYPES=Object.freeze([
  "BETA_WORLD","DEADMAN","NOSAVE_MODE","PVP_ARENA",
  "QUEST_SPEEDRUNNING","SEASONAL","TOURNAMENT_WORLD"
]);
export const COOKIE_NAME="cc_clog_submitter_settings";
export function worldFlags(membership,extra=""){
  if(!["MEMBERS","F2P"].includes(membership))throw new Error("Invalid world membership.");
  if(extra&&!EXTRA_WORLD_TYPES.includes(extra))throw new Error("Invalid world type.");
  return [...new Set([membership,extra].filter(Boolean))].sort();
}
export function normalizeEndpoint(input){
  const url=new URL(input.trim());
  if(url.protocol!=="https:"||!url.hostname||url.username||url.password||url.hash||url.search)
    throw new Error("Use an HTTPS endpoint without URL credentials, a query or a fragment.");
  let path=url.pathname.replace(/\/+$/u,"");
  if(path.endsWith("/api/v1/runelite/submissions"))return url.toString();
  if(path.endsWith("/api/v1"))path+="/runelite/submissions";
  else if(path.endsWith("/api"))path+="/v1/runelite/submissions";
  else path+="/api/v1/runelite/submissions";
  url.pathname=path;
  return url.toString();
}
export function itemOptions(data){
  if(!data||typeof data!=="object"||!data.items||typeof data.items!=="object")
    throw new Error("Invalid item catalogue.");
  return Object.entries(data.items).filter(([id,name])=>
    /^[1-9][0-9]{0,9}$/u.test(id)&&Number(id)<=2147483647&&typeof name==="string"&&!!name.trim()
  ).map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,"en",{sensitivity:"base"})||Number(a.id)-Number(b.id));
}
export function encodeClanKey(value){
  const bytes=new TextEncoder().encode(value);
  let binary="";
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu,"-").replace(/\//gu,"_").replace(/=+$/u,"");
}
export function readCookieSettings(cookies){
  const part=cookies.split(";").map(v=>v.trim()).find(v=>v.startsWith(COOKIE_NAME+"="));
  if(!part)return {};
  try{
    const obj=JSON.parse(decodeURIComponent(part.slice(COOKIE_NAME.length+1)));
    if(!obj||typeof obj!=="object"||Array.isArray(obj))return {};
    const result={};
    for(const name of ["endpoint","username","clanName","itemId","membership","worldType","chatMessage","includeScreenshot"])
      if(typeof obj[name]==="string")result[name]=obj[name];
    return result;
  }catch{return {};}
}
export function cookiePath(pathname){
  return pathname.endsWith("/")?pathname:pathname.replace(/[^/]*$/u,"");
}
export function writeCookieSettings(settings,pathname,secure=true){
  const data={};
  for(const name of ["endpoint","username","clanName","itemId","membership","worldType","chatMessage","includeScreenshot"])
    if(typeof settings[name]==="string")data[name]=settings[name];
  return COOKIE_NAME+"="+encodeURIComponent(JSON.stringify(data))+
    "; Path="+cookiePath(pathname)+"; Max-Age=15552000; SameSite=Strict"+(secure?"; Secure":"");
}

/** Reuse the previous request only when the explicit checkbox is enabled. */
export function submissionKey(lastKey,keepKey,createKey){
  return keepKey&&lastKey?lastKey:createKey();
}

/** The API requires chatMessage; blank input uses a deterministic sample. */
export function effectiveChatMessage(value){
  return typeof value==="string"&&value.trim()?value:"dummy text";
}

/** Optional screenshot is completely omitted when disabled. */
export function createSubmissionBody(fields,screenshotFile=null){
  const body=new FormData();
  body.append("username",fields.username);
  body.append("clanName",fields.clanName);
  body.append("itemId",fields.itemId);
  body.append("worldType",JSON.stringify(fields.worldTypes));
  body.append("chatMessage",effectiveChatMessage(fields.chatMessage));
  if(screenshotFile)body.append("screenshot",screenshotFile,"dummy-submission.png");
  return body;
}
