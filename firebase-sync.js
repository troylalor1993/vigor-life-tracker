import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
 getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
 createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
 getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
 apiKey: "AIzaSyDXJ_sUr3CsHQqY-lfzUN_7V-2G2G9X-JM",
 authDomain: "vigor-life-tracker.firebaseapp.com",
 projectId: "vigor-life-tracker",
 storageBucket: "vigor-life-tracker.firebasestorage.app",
 messagingSenderId: "52317332108",
 appId: "1:52317332108:web:0a369c61869440f41951a9"
};

const $ = id => document.getElementById(id);
const linkedKey = "vigor-cloud-linked-user";
const pendingKey = "vigor-cloud-pending";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let user=null, linked=false, choiceNeeded=false, writing=false, uploadAgain=false, timer=null,cloudBase=null;
const linkedEvent=()=>window.dispatchEvent(new CustomEvent("vigor-cloud-linked",{detail:{uid:user?.uid}}));
const unlinkedEvent=()=>window.dispatchEvent(new Event("vigor-cloud-unlinked"));
const bridge=()=>window.vigorCloudBridge;
const read=()=>bridge()?.read();
const valid=data=>data&&typeof data==="object"&&typeof data.anchor==="string"&&Array.isArray(data.activities)&&Array.isArray(data.measurements);
const cloudDoc=()=>doc(db,"users",user.uid,"data","tracker");
function status(label,details){
 $("cloudStatus").textContent=label;
 $("cloudMessage").textContent=details;

}
function markPending(value){
 try {if(value)localStorage.setItem(pendingKey,"yes");else localStorage.removeItem(pendingKey)}catch(e){}
}
function pending(){try{return localStorage.getItem(pendingKey)==="yes"}catch(e){return false}}
function showChoice(title,description,hasCloud){
 choiceNeeded=true;
 $("cloudChoice").hidden=false;
 $("cloudChoiceTitle").textContent=title;
 $("cloudChoiceDescription").textContent=description;
 $("cloudActionRestore").hidden=!hasCloud;
}
function hideChoice(){choiceNeeded=false;$("cloudChoice").hidden=true}
async function remoteData(){
 const snap=await getDoc(cloudDoc());
 if(!snap.exists())return null;
 const payload=snap.data()?.payload;
 if(!valid(payload))throw new Error("Cloud record format is invalid.");
 cloudBase=JSON.stringify(payload);
 return payload;
}
// Three-way merge protects independent edits saved on another signed-in device.
// Activity logs are matched by record ID/date; daily checklists merge by habit position.
const encoded=value=>JSON.stringify(value);
const cloned=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function mergePersonal(before,local,remote){
 if(encoded(local)===encoded(before))return cloned(remote);
 if(encoded(remote)===encoded(before))return cloned(local);
 if(local===undefined)return undefined;
 if(Array.isArray(local)&&Array.isArray(remote)){
  const key=arr=>arr.every(x=>x&&typeof x==="object"&&(typeof x.id==="string"||typeof x.date==="string"))
   ?(arr.some(x=>x.id!==undefined)?"id":"date"):null;
  const field=key(local)||key(remote)||key(Array.isArray(before)?before:[]);
  if(field){
   const old=new Map((Array.isArray(before)?before:[]).map(x=>[x[field],x]));
   const changed=new Map(local.map(x=>[x[field],x]));
   const merged=new Map(remote.map(x=>[x[field],cloned(x)]));
   for(const [id,val] of old){
    if(!changed.has(id)){merged.delete(id);continue}
    if(encoded(changed.get(id))!==encoded(val))
     merged.set(id,mergePersonal(val,changed.get(id),merged.get(id)));
   }
   for(const [id,val] of changed)if(!old.has(id))merged.set(id,cloned(val));
   return [...merged.values()].filter(x=>x!==undefined);
  }
  return Array.from({length:Math.max(local.length,remote.length)},(_,i)=>
   mergePersonal(Array.isArray(before)?before[i]:undefined,local[i],remote[i]))
   .filter(x=>x!==undefined);
 }
 if(local&&remote&&typeof local==="object"&&typeof remote==="object"&&!Array.isArray(local)&&!Array.isArray(remote)){
  const result={...cloned(remote)};
  for(const k of new Set([...Object.keys(local),...Object.keys(before&&typeof before==="object"&&!Array.isArray(before)?before:{})])){
   if(encoded(local[k])===encoded(before?.[k]))continue;
   const next=mergePersonal(before?.[k],local[k],remote[k]);
   if(next===undefined)delete result[k];else result[k]=next;
  }
  return result;
 }
 return cloned(local);
}
window.addEventListener("vigor-personal-cloud-received",e=>{
 if(e.detail?.uid===user?.uid&&valid(e.detail.payload))cloudBase=JSON.stringify(e.detail.payload);
});
async function upload(){
 if(!user||!linked||choiceNeeded||writing)return;
 if(!navigator.onLine){markPending(true);status("Offline","Progress is on this device; cloud sync will retry when online.");return}
 writing=true;let succeeded=false;
 const account=user, uid=user.uid;
 try{
  const payload=read();if(!valid(payload))throw new Error("Local tracker data is invalid.");
  const before=JSON.stringify(payload);
  const baseline=cloudBase?JSON.parse(cloudBase):null;
  status("Syncing","Securely saving and reconciling changes…");
  const result=await runTransaction(db,async transaction=>{
   const ref=doc(db,"users",uid,"data","tracker");
   const snap=await transaction.get(ref),remote=snap.exists()?snap.data()?.payload:null;
   if(remote&&!valid(remote))throw Error("Cloud tracker data is invalid.");
   const reference=baseline||remote||payload;
   const merged=remote?mergePersonal(reference,payload,remote):payload;
   transaction.set(ref,{payload:merged,format:1,updatedAt:serverTimestamp()});
   return merged;
  });
  if(user!==account||!linked)return;
  cloudBase=JSON.stringify(result);
  const after=read();
  const latest=before===JSON.stringify(after)?result:mergePersonal(payload,after,result);
  if(JSON.stringify(after)!==JSON.stringify(latest))bridge().applyPersonal(latest);
  if(JSON.stringify(latest)===JSON.stringify(result)){
   markPending(false);status("Saved to cloud","Progress synchronized and saved securely.");
  }else{
   markPending(true);uploadAgain=true;
   status("Syncing","Saving edits made while the last update was uploading…");
  }
  succeeded=true;
 }catch(e){
  markPending(true);status("Retry needed","Cloud saving failed: "+(e.code||e.message)+". Your local progress remains available.");
 }finally{
  writing=false;
  if(uploadAgain&&succeeded){uploadAgain=false;scheduleUpload()}
 }
}
function scheduleUpload(){
 if(!linked||!user||choiceNeeded)return;
 markPending(true);
 clearTimeout(timer);
 if(writing){uploadAgain=true;return}
 timer=setTimeout(upload,950);
}
window.addEventListener("vigor-local-changed",scheduleUpload);
async function firstUpload(){
 if(!user||writing)return;
 writing=true;
 try{
  const remote=await remoteData();
  if(remote&&!confirm("Replace your existing cloud backup with THIS device's progress?"))return;
  const local=read();if(!valid(local))throw new Error("Local tracker data is invalid.");
  if(!confirm("Upload the current progress from this device? Save a backup export first if this is important data."))return;
  status("Syncing","Creating your first private cloud backup…");
  await setDoc(cloudDoc(),{payload:local,format:1,updatedAt:serverTimestamp()});
  linked=true;localStorage.setItem(linkedKey,user.uid);hideChoice();linkedEvent();
  const unchanged=JSON.stringify(local)===JSON.stringify(read());
  markPending(!unchanged);
  status(unchanged?"Saved to cloud":"Sync pending",unchanged?"Cloud backup created. Automatic saving is active.":"Backup created. Recent edits will sync next.");
  if(!unchanged)uploadAgain=true;
 }catch(e){status("Upload failed","No progress was removed. "+(e.code||e.message))}
 finally{writing=false;if(uploadAgain){uploadAgain=false;scheduleUpload()}}
}
async function restoreCloud(){
 if(!user||writing)return;
 writing=true;
 try{
  status("Restoring","Loading your existing cloud record…");
  const remote=await remoteData();if(!remote)throw new Error("No existing cloud record found.");
  if(!confirm("Replace the progress on THIS device with the cloud copy? Please export local progress first if needed."))return;
  linked=true;localStorage.setItem(linkedKey,user.uid);markPending(false);hideChoice();linkedEvent();
  bridge().restore(remote);
 }catch(e){status("Restore failed","Local progress remains unchanged. "+(e.code||e.message))}
 finally{writing=false}
}
$("cloudActionUpload").onclick=firstUpload;
$("cloudActionRestore").onclick=restoreCloud;
async function updateSession(current){
 user=current;
 cloudBase=null;linked=false;choiceNeeded=false;clearTimeout(timer);unlinkedEvent();
 $("cloudSignedOut").hidden=!!current;
 $("cloudSignedIn").hidden=!current;
 $("cloudIdentity").textContent=current?"Signed in as "+current.email:"";
 hideChoice();
 if(!current){status("Not connected","This device can still save locally. Sign in to enable private cloud backup.");return}
 status("Checking","Looking for your private Firebase data…");
 try{
  const remote=await remoteData(),sameUser=localStorage.getItem(linkedKey)===current.uid;
  if(!sameUser){
   showChoice(remote?"Choose your data":"Start your cloud backup",remote?"Cloud data already exists for this account. Choose to restore it or deliberately upload this device's data.":"No cloud backup exists yet. Upload the progress from this device to start syncing.",!!remote);
   status("Choose a copy","Nothing has been overwritten.");
  }else if(pending()&&remote){
   showChoice("Unsynced local changes","This device contains changes that may not be backed up. Choose which copy to keep.",true);
   status("Choose a copy","Your local and cloud data have not been replaced.");
  }else if(remote){
   const local=read();
   if(JSON.stringify(remote)!==JSON.stringify(local)){
    // With no pending local edits, this device has already chosen the cloud as source of truth.
    // Preserve its pre-refresh local copy in case the user wants a manual recovery later.
    try{localStorage.setItem("vigor-local-recovery-"+user.uid,JSON.stringify(local))}catch(e){}
    window.vigorCloudBridge.applyPersonal(remote);
    linked=true;linkedEvent();
    status("Updated from cloud","Your latest progress from Firebase was loaded automatically.");
   }else{linked=true;linkedEvent();status("Saved to cloud","Your device and cloud data match. Automatic sync is active.")}
  }else{linked=true;linkedEvent();scheduleUpload()}
 }catch(e){status("Connection issue","Cloud setup could not finish: "+(e.code||e.message)+". Your existing local progress is retained.")}
}
const authError=e=>({
 "auth/email-already-in-use":"This email already has an account. Select Sign in.",
 "auth/invalid-credential":"Email or password not recognized.",
 "auth/weak-password":"Choose a stronger password of at least 6 characters.",
 "auth/network-request-failed":"Network unavailable. Retry when connected.",
 "auth/operation-not-allowed":"Enable Email/Password in Firebase Authentication."
}[e.code]||e.message||"Sign-in unsuccessful.");
async function handleSignIn(signup){
 const email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;
 if(!email||!password){status("Sign-in needed","Enter your email and password.");return}
 try{
  status("Signing in","Connecting securely…");
  await setPersistence(auth,browserLocalPersistence);
  if(signup)await createUserWithEmailAndPassword(auth,email,password);
  else await signInWithEmailAndPassword(auth,email,password);
  $("cloudPassword").value="";
 }catch(e){status("Sign-in failed",authError(e))}
}
$("togglePassword").onclick=()=>{
 const input=$("cloudPassword"),show=input.type==="password";
 input.type=show?"text":"password";
 $("togglePassword").textContent=show?"Hide":"Show";
 $("togglePassword").setAttribute("aria-label",show?"Hide password":"Show password");
 $("togglePassword").setAttribute("aria-pressed",String(show));
};
$("cloudSignIn").onclick=()=>handleSignIn(false);
$("cloudSignUp").onclick=()=>handleSignIn(true);
$("cloudSignOut").onclick=async()=>{
 try{
  if(pending()&&linked&&navigator.onLine)await upload();
  if(pending()&&!confirm("This device has changes not confirmed in the cloud. Sign out anyway?"))return;
  clearTimeout(timer);linked=false;unlinkedEvent();await signOut(auth);
  // Local data remains intact for recovery; users sharing this device should use different browser profiles.
  localStorage.removeItem(linkedKey);
 }catch(e){status("Sign-out failed",e.message)}
};
$("cloudSyncNow").onclick=async()=>{
 if(choiceNeeded){status("Choose a copy","Select Upload this device or Restore cloud copy first.");return}
 if(!linked){status("Not linked","Finish the first sync setup.");return}
 markPending(true);await upload();
};
window.addEventListener("online",()=>{if(pending()&&linked)scheduleUpload()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&pending()&&linked)scheduleUpload()});
onAuthStateChanged(auth,current=>{void updateSession(current)});
