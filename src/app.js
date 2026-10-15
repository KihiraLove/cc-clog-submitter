import {
  BLOCKED_WORLD_TYPES, COOKIE_NAME, cookiePath, encodeClanKey, itemOptions,
  normalizeEndpoint, readCookieSettings, worldFlags, writeCookieSettings
} from "./submission.js";
const el=(id)=>document.getElementById(id);
const form=el("submission-form"),endpoint=el("endpoint"),clanKey=el("api-key");
const username=el("username"),clanName=el("clan-name"),itemSearch=el("item-search");
const itemSelect=el("item-id"),itemCount=el("item-count"),worldType=el("world-type");
const keyInput=el("idempotency-key"),notice=el("notice"),submitButton=el("submit");
const responseSection=el("response-section"),responseBody=el("response-body");
const responseDescription=el("response-description");
const saved=readCookieSettings(document.cookie);
let allItems=[],pending=false,screenshot=null,initialItemId=saved.itemId||"";
function membership(){return form.querySelector('input[name="membership"]:checked').value;}
function newKey(){keyInput.value=crypto.randomUUID();}
function preferences(){
  return {endpoint:endpoint.value,username:username.value,clanName:clanName.value,
    itemId:itemSelect.value,membership:membership(),worldType:worldType.value};
}
function remember(){
  document.cookie=writeCookieSettings(preferences(),location.pathname,location.protocol==="https:");
}
function showNotice(message,kind=""){
  notice.hidden=false;notice.className="notice "+kind;notice.textContent=message;
}
function updateWorldNote(){
  const flags=worldFlags(membership(),worldType.value),note=el("world-note");
  note.className="inline-note";
  if(BLOCKED_WORLD_TYPES.includes(worldType.value)){
    note.className+=" warn";
    note.textContent=worldType.value+" worlds are deliberately rejected by the API (HTTP 403). Submit to test the rejection response.";
  }else if(worldType.value==="HARDCORE_MAIN"){
    note.className+=" warn";
    note.textContent="HARDCORE_MAIN does not mark a submission as hardcore in the current API; only HC_WORLD_PLACEHOLDER / HC_WORLDS_PLACEHOLDER do.";
  }else note.textContent="World flags sent: "+JSON.stringify(flags);
}
function drawItems(){
  const query=itemSearch.value.trim().toLowerCase();
  const selected=itemSelect.value||initialItemId;
  const filtered=query?allItems.filter(item=>item.name.toLowerCase().includes(query)||item.id.includes(query)):allItems;
  itemSelect.replaceChildren();
  itemSelect.add(new Option(filtered.length?"Choose an item…":"No matching items",""));
  for(const item of filtered)itemSelect.add(new Option(item.name+" (ID "+item.id+")",item.id));
  if(filtered.some(item=>item.id===selected))itemSelect.value=selected;
  itemSelect.disabled=!filtered.length;
  itemCount.textContent=filtered.length+" of "+allItems.length+" item IDs";
  initialItemId="";
}
async function loadItems(){
  try{
    const response=await fetch("./data/items.json",{cache:"force-cache"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    allItems=itemOptions(await response.json());
    if(!allItems.length)throw new Error("No items in catalogue.");
    drawItems();
  }catch(error){itemCount.textContent="Could not load items";showNotice("Item catalogue: "+error.message,"error");}
}
async function sampleScreenshot(){
  if(!screenshot){
    const response=await fetch("./assets/dummy-submission.png",{cache:"force-cache"});
    if(!response.ok)throw new Error("Sample screenshot could not be loaded (HTTP "+response.status+").");
    screenshot=new File([await response.blob()],"dummy-submission.png",{type:"image/png"});
  }
  return screenshot;
}
endpoint.value=saved.endpoint||"";
username.value=saved.username||"";
clanName.value=saved.clanName||"";
worldType.value=saved.worldType||"";
form.querySelector('input[name="membership"][value="'+(saved.membership==="F2P"?"F2P":"MEMBERS")+'"]').checked=true;
newKey();updateWorldNote();void loadItems();
for(const field of [endpoint,username,clanName,itemSelect,worldType]){
  field.addEventListener("change",()=>{if(!pending){newKey();remember();updateWorldNote();}});
}
for(const field of [endpoint,username,clanName]){
  field.addEventListener("input",()=>{if(!pending){newKey();remember();}});
}
for(const radio of form.querySelectorAll('input[name="membership"]'))
  radio.addEventListener("change",()=>{if(!pending){newKey();remember();updateWorldNote();}});
itemSearch.addEventListener("input",drawItems);
el("new-key").addEventListener("click",()=>{newKey();showNotice("A new idempotency key has been generated.");});
el("toggle-key").addEventListener("click",()=>{
  clanKey.type=clanKey.type==="password"?"text":"password";
  el("toggle-key").textContent=clanKey.type==="password"?"Show":"Hide";
});
el("clear-settings").addEventListener("click",()=>{
  document.cookie=COOKIE_NAME+"=; Path="+cookiePath(location.pathname)+"; Max-Age=0; SameSite=Strict"+
    (location.protocol==="https:"?"; Secure":"");
  form.reset();endpoint.value="";username.value="";clanName.value="";clanKey.value="";
  itemSearch.value="";initialItemId="";drawItems();newKey();updateWorldNote();
  responseSection.hidden=true;
  showNotice("Saved settings and the tab's API key have been cleared.");
});
form.addEventListener("submit",async(event)=>{
  event.preventDefault();
  if(pending||!form.reportValidity())return;
  let target;
  try{target=normalizeEndpoint(endpoint.value);}
  catch(error){showNotice(error.message,"error");return;}
  const chosen=preferences();
  if(!chosen.itemId||!allItems.some(item=>item.id===chosen.itemId)){
    showNotice("Choose an item from the catalogue.","error");return;
  }
  if(!chosen.username.trim()||!chosen.clanName.trim()){
    showNotice("Username and clan name cannot be blank.","error");return;
  }
  const key=keyInput.value,flags=worldFlags(chosen.membership,chosen.worldType);
  pending=true;submitButton.disabled=true;submitButton.textContent="Sending…";
  responseSection.hidden=true;showNotice("Uploading screenshot to "+target);
  remember();
  try{
    const body=new FormData();
    body.append("username",chosen.username);
    body.append("clanName",chosen.clanName);
    body.append("itemId",chosen.itemId);
    body.append("worldType",JSON.stringify(flags));
    body.append("screenshot",await sampleScreenshot());
    const headers={"Idempotency-Key":key};
    if(clanKey.value)headers["X-Clan-API-Key-Base64"]=encodeClanKey(clanKey.value);
    const response=await fetch(target,{method:"POST",headers,body,mode:"cors",
      credentials:"omit",redirect:"error",cache:"no-store",referrerPolicy:"no-referrer"});
    const raw=await response.text();
    let result;
    try{result=JSON.parse(raw);}catch{result=raw||"(empty response)";}
    responseBody.textContent=typeof result==="string"?result:JSON.stringify(result,null,2);
    responseDescription.textContent="HTTP "+response.status+" · Idempotency-Key: "+key;
    responseSection.hidden=false;
    if(response.ok){showNotice("Accepted (HTTP "+response.status+"). Receipt below. A new UUID is ready.","success");newKey();}
    else showNotice("Rejected (HTTP "+response.status+"). UUID retained for retry.","error");
  }catch(error){
    showNotice("Browser request failed: "+error.message+
      "\nVerify HTTPS, certificate, connectivity and CORS. The API/proxy must allow this Pages Origin and preflight OPTIONS for Idempotency-Key, X-Clan-API-Key-Base64 and Content-Type. The request result is unknown; this UUID is retained for safe retry.","error");
  }finally{pending=false;submitButton.disabled=false;submitButton.textContent="Send submission";}
});
