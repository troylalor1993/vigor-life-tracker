import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
 getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
 createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
 getFirestore, doc, getDoc, setDoc, serverTimestamp
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
let user=null, linked=false, choiceNeeded=false, writing=false, uploadAgain=false, timer=null;
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
 return payload;
}
async function upload(){
 if(!user||!linked||choiceNeeded||writing)return;
 if(!navigator.onLine){markPending(true);status("Offline","Progress is on this device; cloud sync will retry when online.");return}
 writing=true;
 try{
  const payload=read();if(!valid(payload))throw new Error("Local tracker data is invalid.");
  const before=JSON.stringify(payload);
  status("Syncing","Saving your changes to Firebase…");
  await setDoc(cloudDoc(),{payload,format:1,updatedAt:serverTimestamp()});
  if(before===JSON.stringify(read())&&!uploadAgain){
   markPending(false);status("Saved to cloud","Your progress is saved to this device and Firebase.");
  }else{markPending(true);uploadAgain=true}
 }catch(e){markPending(true);status("Retry needed","Cloud upload failed: "+(e.code||e.message)+". Your local progress remains available.")}
 finally{
  writing=false;
  if(uploadAgain){uploadAgain=false;scheduleUpload()}
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
 linked=false;choiceNeeded=false;clearTimeout(timer);unlinkedEvent();
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
