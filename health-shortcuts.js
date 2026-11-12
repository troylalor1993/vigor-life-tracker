import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const auth=getAuth(getApp());
const $=id=>document.getElementById(id);
const key="vigor-health-pending";
const linked="vigor-cloud-linked-user";
let current=null,attempted=false;
const feedback=message=>{const node=$("healthImportStatus");if(node)node.textContent=message};
function parse(fragment){
 if(!fragment.startsWith("#health="))return null;
 const value=decodeURIComponent(fragment.slice(8)).trim();
 const parts=value.split(",").map(v=>v.trim());
 if(parts.length!==3)throw Error("Expected a date, steps, and active calorie total.");
 const [date,rawSteps,rawCalories]=parts;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d+$/.test(rawSteps)||!/^\d+$/.test(rawCalories))throw Error("Health values must be a date and two whole numbers.");
 const steps=Number(rawSteps),calories=Number(rawCalories);
 const today=new Date(),localDate=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
 if(date>localDate||date<"2020-01-01"||steps>150000||calories>10000)throw Error("Health values are outside allowed daily limits.");
 return {date,steps,calories};
}
function ingestUrl(){
 try{
  if(!location.hash.startsWith("#health="))return;
  const sample=parse(location.hash);
  // Remove health values from the visible URL and browser history immediately.
  history.replaceState(null,"",location.pathname+location.search);
  sessionStorage.setItem(key,JSON.stringify(sample));
  attempted=false;
  maybeImport();
 }catch(e){
  history.replaceState(null,"",location.pathname+location.search);
  feedback("Import link rejected: "+e.message);
 }
}
function maybeImport(){
 if(attempted||!current)return;
 const raw=sessionStorage.getItem(key);
 if(!raw)return;
 if(localStorage.getItem(linked)!==current.uid){
  feedback("Sign into your personal Firebase account and complete the cloud backup setup before importing Apple Health activity. Your pending Health totals are retained in this browser session.");
  return;
 }
 let sample;
 try{sample=JSON.parse(raw)}catch(e){sessionStorage.removeItem(key);return}
 attempted=true;
 const detail=$("healthImportInfo");if(detail)detail.open=true;
 if(!confirm("Import "+sample.steps.toLocaleString()+" steps and "+sample.calories+" active kcal from Apple Health for "+sample.date+" into THIS signed-in account? Any existing totals for that date will be replaced.")){
  feedback("Health import cancelled. Existing activity data was not changed.");
  sessionStorage.removeItem(key);return;
 }
 try{
  window.vigorCloudBridge.importHealth(sample);
  sessionStorage.removeItem(key);
  feedback("✓ Imported "+sample.steps.toLocaleString()+" steps and "+sample.calories+" active kcal for "+sample.date+". Firebase sync will save them automatically.");
 }catch(e){attempted=false;feedback("Import could not be completed: "+e.message)}
}
window.addEventListener("hashchange",ingestUrl);
window.addEventListener("vigor-cloud-linked",maybeImport);
onAuthStateChanged(auth,user=>{current=user;maybeImport()});
ingestUrl();
