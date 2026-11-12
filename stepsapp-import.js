import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const $=id=>document.getElementById(id);
const auth=getAuth(getApp());
let user=null,ready=[],busy=false;
const preview=$("stepsAppPreview"),status=$("stepsAppStatus"),fileInput=$("stepsAppFile"),button=$("stepsAppConfirm"),check=$("stepsAppCalories");
const currentDate=()=>{
 const d=new Date();
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const failed=message=>{status.textContent=message;button.disabled=true;ready=[]};
const data=()=>window.vigorCloudBridge?.read()?.dailyActivity||{};
function describe(){
 if(!ready.length)return;
 const existing=data();
 let steps=0,calories=0,already=0;
 for(const r of ready){
  const e=existing[r.date]||{};
  if(e.steps===null||e.steps===undefined)steps++;
  if(check.checked&&(e.calories===null||e.calories===undefined))calories++;
  if(e.steps!==null&&e.steps!==undefined)already++;
 }
 preview.textContent=ready.length+" recent daily records found ("+ready[0].date+" to "+ready[ready.length-1].date+"). "+steps+" missing step days"+(check.checked?" and "+calories+" missing calorie days":"")+". "+already+" days already have step entries and will not be overwritten.";
 button.disabled=steps+calories===0;
}
function parseCSV(csv){
 const lines=csv.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
 if(lines.length<3)throw Error("The daily CSV has no activity records.");
 const cols=lines[0].toLowerCase().split(";").map(x=>x.trim());
 const dateCol=cols.indexOf("date"),stepsCol=cols.indexOf("steps"),calCol=cols.indexOf("calories [kcal]");
 if(dateCol<0||stepsCol<0||calCol<0)throw Error("Not a supported StepsApp daily activity export.");
 if(!/^daily-activity-data;v\d+/i.test(lines[1]))throw Error("Please select activity-export-daily.csv, not hourly or monthly activity.");
 const dates=new Map(),today=currentDate();
 for(const line of lines.slice(2)){
  const row=line.split(";"),date=(row[dateCol]||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>today)continue;
  const n=Number(row[stepsCol]),k=Number(row[calCol]);
  if(!Number.isFinite(n)||!Number.isFinite(k)||n<0||n>150000||k<0||k>10000)continue;
  dates.set(date,{date,steps:Math.round(n),calories:Math.round(k)});
 }
 if(!dates.size)throw Error("No valid daily steps/calories were found.");
 const all=[...dates.values()].sort((a,b)=>a.date.localeCompare(b.date));
 // Restrict imports to the last 30 calendar days rather than sending years of history to Firebase.
 const midnight=new Date(today+"T12:00:00");
 midnight.setDate(midnight.getDate()-29);
 const cutoff=[midnight.getFullYear(),String(midnight.getMonth()+1).padStart(2,"0"),String(midnight.getDate()).padStart(2,"0")].join("-");
 const recent=all.filter(r=>r.date>=cutoff);
 if(!recent.length)throw Error("The export contains no records from the last 30 days.");
 return recent;
}
async function readFile(file){
 if(file.size>20000000)throw Error("The file is too large. Export a smaller StepsApp ZIP or choose the daily CSV.");
 if(/\.csv$/i.test(file.name))return await file.text();
 if(!/\.zip$/i.test(file.name))throw Error("Choose StepsAppExport.zip or activity-export-daily.csv.");
 // Only the specific daily CSV is read, not the export's weight or other personal records.
 const {default:JSZip}=await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
 const archive=await JSZip.loadAsync(file);
 const match=Object.values(archive.files).find(f=>!f.dir&&f.name.split("/").pop()==="activity-export-daily.csv");
 if(!match)throw Error("The ZIP does not contain activity-export-daily.csv.");
 if(match._data?.uncompressedSize>5000000)throw Error("Daily activity CSV exceeds the safe size limit.");
 return await match.async("string");
}
fileInput.onchange=async()=>{
 ready=[];button.disabled=true;
 const file=fileInput.files?.[0];if(!file)return;
 preview.textContent="Reading your StepsApp daily records on this device…";status.textContent="";
 try{
  ready=parseCSV(await readFile(file));
  describe();
 }catch(e){preview.textContent="No import preview available.";failed("Could not read StepsApp export: "+e.message)}
};
check.onchange=describe;
button.onclick=()=>{
 if(busy||!ready.length)return;
 if(!user||localStorage.getItem("vigor-cloud-linked-user")!==user.uid){
  status.textContent="Please finish connecting your private Firebase account under Settings first. Nothing was imported.";
  return;
 }
 describe();
 if(button.disabled)return;
 if(!confirm("Import missing StepsApp steps"+(check.checked?" and estimated calories":"")+" for up to 30 recent days into "+(user.email||"this account")+"? Existing values, including Apple Watch activity, will be preserved."))return;
 busy=true;button.disabled=true;
 try{
  const result=window.vigorCloudBridge.importStepsApp(ready,check.checked);
  status.textContent="✓ Imported "+result.stepDays+" missing step days and "+result.calorieDays+" missing calorie days. "+result.skipped+" days unchanged. These changes are queued for private Firebase syncing.";
  describe();
 }catch(e){status.textContent="Import failed: "+e.message}
 finally{busy=false}
};
onAuthStateChanged(auth,u=>{user=u});
