import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const db=getFirestore(getApp()),auth=getAuth(getApp());
let unsubscribe=null,activeUid=null;
const status=(heading,detail)=>{
 const badge=document.getElementById("cloudStatus"),message=document.getElementById("cloudMessage");
 if(badge)badge.textContent=heading;
 if(message)message.textContent=detail;
};
const linkedKey="vigor-cloud-linked-user",pendingKey="vigor-cloud-pending";
function start(uid){
 stop();
 if(!uid||auth.currentUser?.uid!==uid||localStorage.getItem(linkedKey)!==uid)return;
 activeUid=uid;
 unsubscribe=onSnapshot(doc(db,"users",uid,"data","tracker"),snap=>{
  if(!snap.exists()||activeUid!==auth.currentUser?.uid)return;
  // Local edits always take precedence until they have been confirmed in Firestore.
  if(localStorage.getItem(pendingKey)==="yes")return;
  const latest=snap.data()?.payload,local=window.vigorCloudBridge?.read();
  if(!latest||!Array.isArray(latest.measurements)||!Array.isArray(latest.activities)||!latest.anchor)return;
  if(JSON.stringify(latest)!==JSON.stringify(local)){
   try{
    window.vigorCloudBridge?.applyPersonal(latest);
    status("Updated from cloud","Latest changes from your other device are now visible.");
   }catch(e){status("Refresh issue","Could not apply a cloud update. Local progress was not erased.")}
  }
 },e=>status("Live sync issue",e.message||"Realtime connection unavailable."));
}
function stop(){
 if(unsubscribe){unsubscribe();unsubscribe=null}
 activeUid=null;
}
window.addEventListener("vigor-cloud-linked",event=>start(event.detail?.uid));
window.addEventListener("vigor-cloud-unlinked",stop);
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden&&activeUid){const uid=activeUid;start(uid)}
});
