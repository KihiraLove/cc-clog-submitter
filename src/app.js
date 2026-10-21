import {
  BLOCKED_WORLD_TYPES, COOKIE_NAME, cookiePath, encodeClanKey, itemOptions,
  createSubmissionBody, normalizeEndpoint, readCookieSettings, submissionKey, worldFlags, writeCookieSettings
} from "./submission.js";
const el=(id)=>document.getElementById(id);
const form=el("submission-form"),endpoint=el("endpoint"),clanKey=el("api-key");
const username=el("username"),clanName=el("clan-name"),itemSearch=el("item-search");
const itemResults=el("item-results"),selectedItem=el("selected-item"),worldType=el("world-type");
const keepKey=el("keep-idempotency-key"),includeScreenshot=el("include-screenshot");
const chatMessage=el("chat-message"),notice=el("notice"),submitButton=el("submit");
const responseSection=el("response-section"),responseBody=el("response-body");
const responseDescription=el("response-description");
const saved=readCookieSettings(document.cookie);
let allItems=[],pending=false,screenshot=null,selectedItemId=saved.itemId||"",lastKey=null;
function membership(){return form.querySelector('input[name="membership"]:checked').value;}

function preferences(){
  return {endpoint:endpoint.value,username:username.value,clanName:clanName.value,
    itemId:selectedItemId,membership:membership(),worldType:worldType.value,
    chatMessage:chatMessage.value,includeScreenshot:String(includeScreenshot.checked)};
}
function remember(){
  document.cookie=writeCookieSettings(preferences(),location.pathname,location.protocol==="https:");
}
function showNotice(message,kind=""){
  notice.hidden=false;notice.className="notice "+kind;notice.textContent=message;
}
function updateWorldNote(){
  const note=el("world-note");
  note.hidden=false;
  note.className="inline-note warn";
  if(BLOCKED_WORLD_TYPES.includes(worldType.value)){
    note.textContent=worldType.value+" worlds are deliberately rejected by the API (HTTP 403). Submit to test the rejection response.";
  }else if(worldType.value==="HARDCORE_MAIN"){
    note.textContent="HARDCORE_MAIN marks the submission as hardcore in the current API.";
  }else{
    note.textContent="";
    note.hidden=true;
  }
}
function updateSelectedItem(){
  const item=allItems.find(entry=>entry.id===selectedItemId);
  selectedItem.textContent=item?"Selected: "+item.name+" (ID "+item.id+")":"No item selected";
}
function drawItems(){
  const query=itemSearch.value.trim().toLowerCase();
  const filtered=query?allItems.filter(item=>
    item.name.toLowerCase().includes(query)||item.id.includes(query)):allItems;
  const fragment=document.createDocumentFragment();
  if(!filtered.length){
    const message=document.createElement("p");
    message.className="item-message";
    message.textContent=allItems.length?"No matching items.":"Catalogue unavailable.";
    fragment.append(message);
  }else{
    for(const item of filtered){
      const button=document.createElement("button");
      button.type="button";
      button.className="item-choice";
      button.dataset.itemId=item.id;
      button.setAttribute("aria-pressed",String(item.id===selectedItemId));
      button.textContent=item.name+" (ID "+item.id+")";
      button.title=button.textContent;
      fragment.append(button);
    }
  }
  itemResults.replaceChildren(fragment);
  itemResults.setAttribute("aria-busy","false");
  updateSelectedItem();
}
async function loadItems(){
  try{
    const response=await fetch("./data/items.json",{cache:"force-cache"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    allItems=itemOptions(await response.json());
    if(!allItems.length)throw new Error("No items in catalogue.");
    if(!allItems.some(item=>item.id===selectedItemId))selectedItemId="";
    drawItems();
  }catch(error){
    itemResults.setAttribute("aria-busy","false");
    itemResults.replaceChildren();
    const message=document.createElement("p");
    message.className="item-message";
    message.textContent="Could not load items.";
    itemResults.append(message);
    showNotice("Item catalogue: "+error.message,"error");
  }
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
chatMessage.value=saved.chatMessage||"";
includeScreenshot.checked=saved.includeScreenshot!=="false";
form.querySelector('input[name="membership"][value="'+(saved.membership==="F2P"?"F2P":"MEMBERS")+'"]').checked=true;
updateWorldNote();void loadItems();
for(const field of [endpoint,username,clanName,worldType,chatMessage,includeScreenshot]){
  field.addEventListener("change",()=>{if(!pending){remember();updateWorldNote();}});
}
for(const field of [endpoint,username,clanName,chatMessage]){
  field.addEventListener("input",()=>{if(!pending)remember();});
}
for(const radio of form.querySelectorAll('input[name="membership"]'))
  radio.addEventListener("change",()=>{if(!pending){remember();updateWorldNote();}});
itemSearch.addEventListener("input",drawItems);
itemResults.addEventListener("click",(event)=>{
  const choice=event.target.closest("button[data-item-id]");
  if(pending||!choice||!itemResults.contains(choice))return;
  selectedItemId=choice.dataset.itemId;
  for(const button of itemResults.querySelectorAll("button[data-item-id]"))
    button.setAttribute("aria-pressed",String(button===choice));
  updateSelectedItem();
  remember();
});
keepKey.addEventListener("change",()=>{
  if(!keepKey.checked)lastKey=null;
});
el("toggle-key").addEventListener("click",()=>{
  clanKey.type=clanKey.type==="password"?"text":"password";
  el("toggle-key").textContent=clanKey.type==="password"?"Show":"Hide";
});
el("clear-settings").addEventListener("click",()=>{
  document.cookie=COOKIE_NAME+"=; Path="+cookiePath(location.pathname)+"; Max-Age=0; SameSite=Strict"+
    (location.protocol==="https:"?"; Secure":"");
  form.reset();endpoint.value="";username.value="";clanName.value="";clanKey.value="";
  itemSearch.value="";selectedItemId="";lastKey=null;chatMessage.value="";
  includeScreenshot.checked=true;drawItems();updateWorldNote();
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
  const chosenItem=allItems.find(item=>item.id===chosen.itemId);
  if(!chosenItem){
    showNotice("Choose an item from the catalogue.","error");return;
  }
  if(chosenItem.name.length>200){
    showNotice("The selected item name exceeds the API's 200-character limit.","error");return;
  }
  if(!chosen.username.trim()||!chosen.clanName.trim()){
    showNotice("Username and clan name cannot be blank.","error");return;
  }
  const flags=worldFlags(chosen.membership,chosen.worldType);
  pending=true;submitButton.disabled=true;submitButton.textContent="Sending…";
  responseSection.hidden=true;remember();
  try{
    let body;
    try{
      const screenshotFile=includeScreenshot.checked?await sampleScreenshot():null;
      body=createSubmissionBody({...chosen,itemName:chosenItem.name,worldTypes:flags},screenshotFile);
    }catch(error){
      showNotice("Could not prepare submission: "+error.message+" The API was not contacted.","error");
      return;
    }
    const key=submissionKey(lastKey,keepKey.checked,()=>crypto.randomUUID());
    lastKey=key;
    const headers={"Idempotency-Key":key};
    if(clanKey.value)headers["X-Clan-API-Key-Base64"]=encodeClanKey(clanKey.value);
    showNotice("Sending submission to "+target);
    try{
      const response=await fetch(target,{method:"POST",headers,body,mode:"cors",
        credentials:"omit",redirect:"error",cache:"no-store",referrerPolicy:"no-referrer"});
      const raw=await response.text();
      let result;
      try{result=JSON.parse(raw);}catch{result=raw||"(empty response)";}
      responseBody.textContent=typeof result==="string"?result:JSON.stringify(result,null,2);
      responseDescription.textContent="HTTP "+response.status+" · Idempotency-Key: "+key;
      responseSection.hidden=false;
      if(response.ok)showNotice("Accepted (HTTP "+response.status+"). Receipt below.","success");
      else showNotice("Rejected (HTTP "+response.status+"). See the response below.","error");
    }catch(error){
      showNotice("Browser request failed: "+error.message+
        "\nInspect the browser Network tab for OPTIONS and POST to "+target+
        ". The preflight must allow origin "+location.origin+
        " and headers Idempotency-Key, X-Clan-API-Key-Base64 and Content-Type. Check for redirects (this client blocks them), failed TLS/network connections, or missing CORS headers on either response. If the POST reached the API, its outcome is unknown: check the idempotency checkbox before retrying the unchanged submission.","error");
    }
  }finally{pending=false;submitButton.disabled=false;submitButton.textContent="Send submission";}
});
