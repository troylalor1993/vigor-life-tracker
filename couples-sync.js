import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, sendEmailVerification, reload, getIdToken } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
const db=getFirestore(getApp());
const auth=getAuth(getApp());
let user=null, coupleId=null, sharedReady=false, unlisten=null, writing=false, queued=false, timer=null, baseline=null;
const valid=x=>x&&typeof x==="object"&&Array.isArray(x.goals)&&Array.isArray(x.goalLogs);
const writeStatus=(label,detail)=>{
 $("coupleCloudBadge").textContent=label;
 $("coupleConnectStatus").textContent=detail;
};
const pairDoc=id=>doc(db,"couples",id);
const linkDoc=()=>doc(db,"users",user.uid,"data","coupleLink");
const readShared=()=>window.vigorCloudBridge?.read()?.couples;
const active=()=>!!(user&&coupleId&&sharedReady);
const tidyError=e=>e?.code==="permission-denied"?"Permission denied. The shared Couples Firestore rules must be published first, or the invitation email must be verified.":(e?.message||"Connection problem.");
function showLinked(isLinked){
 $("coupleNotLinked").hidden=!!isLinked;
 $("coupleLinked").hidden=!isLinked;
 $("coupleCopyInvite").hidden=!isLinked;
 $("coupleInvitationDisplay").textContent=isLinked?"Private invitation code: "+coupleId:"";
 $("coupleSyncHint").textContent=isLinked?"Shared with your connected partner through Firebase. Personal fitness data stays private.":"Connect your accounts above to share goals, prayers, encouragement and rewards in real time.";
}
async function attach(id){
 if(unlisten){unlisten();unlisten=null}
 coupleId=id;sharedReady=false;baseline=null;
 showLinked(true);writeStatus("Connecting","Loading your shared Couples section…");
 unlisten=onSnapshot(pairDoc(id),snap=>{
  if(!snap.exists()){writeStatus("Unavailable","This shared space no longer exists.");return}
  const record=snap.data();
  if(!record.members?.includes(auth.currentUser?.uid)){writeStatus("Waiting","Waiting for your account to be added as a partner.");return}
  if(!valid(record.shared)){writeStatus("Data issue","The shared data needs repair. Your local data is unchanged.");return}
  if(writing||queued)return; // Preserve uncommitted local edits before accepting an incoming copy.
  const incoming=JSON.stringify(record.shared);
  if(incoming!==baseline){
   baseline=incoming;
   window.vigorCloudBridge?.applyCouples(record.shared);
  }
  sharedReady=true;
  window.vigorCouplesSharedActive=true;
  writeStatus(record.members.length>=2?"Connected together":"Invitation ready",record.members.length>=2?"Shared goals and encouragements are updating across both accounts.":"Share the code with your partner. They must verify their email before joining.");
 },err=>writeStatus("Sync issue",tidyError(err)));
}
// Three-way merge retains independent changes made on either phone.
const json=value=>JSON.stringify(value);
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function mergeList(before=[],local=[],remote=[]){
 const base=new Map(before.map(x=>[x.id,x]));
 const user=new Map(local.map(x=>[x.id,x]));
 const merged=new Map(remote.map(x=>[x.id,copy(x)]));
 for(const [id,original] of base){
  if(!user.has(id)){merged.delete(id);continue}
  const changed=user.get(id);
  if(json(changed)!==json(original))merged.set(id,copy(changed));
 }
 for(const [id,value] of user)if(!base.has(id))merged.set(id,copy(value));
 return [...merged.values()];
}
function mergeObject(before={},local={},remote={}){
 const result={...copy(remote)};
 for(const key of new Set([...Object.keys(before||{}),...Object.keys(local||{})])){
  const earlier=before?.[key],mine=local?.[key];
  if(json(mine)===json(earlier))continue;
  if(mine===undefined){delete result[key];continue}
  const theirs=remote?.[key];
  if(Array.isArray(mine)&&mine.every(x=>x&&typeof x==="object"&&typeof x.id==="string")){
   result[key]=mergeList(Array.isArray(earlier)?earlier:[],mine,Array.isArray(theirs)?theirs:[]);
  }else if(mine&&typeof mine==="object"&&!Array.isArray(mine)&&theirs&&typeof theirs==="object"&&!Array.isArray(theirs)){
   result[key]=mergeObject(earlier&&typeof earlier==="object"?earlier:{},mine,theirs);
  }else result[key]=copy(mine);
 }
 return result;
}
function mergeShared(before,local,remote){
 const result={...copy(remote)};
 for(const key of new Set([...Object.keys(local),...Object.keys(before||{})])){
  if(json(local[key])===json(before?.[key]))continue;
  if(key==="goals"||key==="goalLogs"){
   result[key]=mergeList(before?.[key]||[],local[key]||[],remote[key]||[]);
  }else if(local[key]&&typeof local[key]==="object"&&!Array.isArray(local[key])){
   result[key]=mergeObject(before?.[key]||{},local[key],remote[key]||{});
  }else result[key]=copy(local[key]);
 }
 return result;
}
async function saveShared(){
 if(!active()||writing)return;
 if(!navigator.onLine){queued=true;writeStatus("Offline","Your changes are saved locally. Shared sync will retry when online.");return}
 writing=true;queued=false;let succeeded=false;
 const userAtStart=user, idAtStart=coupleId;
 try{
  const myChanges=readShared();if(!valid(myChanges))throw Error("Shared Couples data is invalid.");
  const localStart=json(myChanges);
  const base=baseline?JSON.parse(baseline):copy(myChanges);
  writeStatus("Syncing","Merging and saving changes from both phones…");
  const merged=await runTransaction(db,async txn=>{
   const ref=pairDoc(idAtStart),snapshot=await txn.get(ref);
   if(!snapshot.exists())throw Error("The shared space no longer exists.");
   const record=snapshot.data();
   if(!record.members?.includes(userAtStart.uid)||!valid(record.shared))throw Error("Your account is not linked to this shared space.");
   const next=mergeShared(base,myChanges,record.shared);
   txn.update(ref,{shared:next,updatedAt:serverTimestamp()});
   return next;
  });
  if(user!==userAtStart||coupleId!==idAtStart)return;
  // Rebase edits made while the transaction was in flight, rather than losing them.
  const now=readShared();
  const next=json(now)!==localStart?mergeShared(myChanges,now,merged):merged;
  baseline=json(merged);succeeded=true;
  if(json(next)!==json(now))window.vigorCloudBridge.applyCouples(next);
  if(json(next)!==baseline){queued=true}
  else writeStatus("Saved together","Shared changes from both phones are saved.");
 }catch(e){
  queued=true;writeStatus("Retry needed","Shared edits are still on this device. "+tidyError(e));
 }finally{
  writing=false;
  // Avoid a tight error retry loop: errors retry on reconnect, foreground, or next edit.
  if(queued&&navigator.onLine&&json(readShared())!==baseline){
   // Retry only if a newer edit arrived DURING the successful transaction.
   if(succeeded)schedule();
  }
 }
}
function schedule(){
 if(!active())return;
 const current=JSON.stringify(readShared());
 if(current===baseline)return;
 queued=true;clearTimeout(timer);
 timer=setTimeout(()=>{if(!writing)void saveShared()},1100);
}
window.addEventListener("vigor-local-changed",schedule);
window.addEventListener("online",()=>{if(queued&&active())schedule()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&queued&&active())schedule()});
async function connectExisting(){
 const current=user;
 if(!current){showLinked(false);writeStatus("Sign in needed","Sign in under Settings first.");return}
 try{
  const snap=await getDoc(linkDoc());
  if(user!==current)return;
  const id=snap.exists()?snap.data()?.coupleId:null;
  if(typeof id==="string"&&/^[a-f0-9]{32}$/.test(id))await attach(id);
  else {coupleId=null;sharedReady=false;showLinked(false);writeStatus("Not linked","Create an invitation or enter your partner's private code.");}
 }catch(e){writeStatus("Connection issue",tidyError(e))}
}
$("coupleCreateInvite").onclick=async()=>{
 if(!user)return writeStatus("Sign in needed","Sign in under Settings first.");
 if(coupleId)return writeStatus("Already linked","You already have a shared Couples space.");
 const invitedEmail=$("couplePartnerEmail").value.trim().toLowerCase();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(invitedEmail))return writeStatus("Email needed","Enter your partner's email address.");
 if(invitedEmail===user.email?.toLowerCase())return writeStatus("Different account needed","Enter your partner's email, not your own.");
 try{
  const id=crypto.randomUUID().replaceAll("-","");
  const personal=window.vigorCloudBridge?.read();
  const existing=readShared();if(!valid(existing))throw Error("Couples data is not ready.");
  const shared={...existing,sharedAnchor:personal.anchor||"2026-11-12",sharedCycleLength:personal.cycleLength===7?7:8};
  writeStatus("Creating","Preparing your secure invitation…");
  await setDoc(pairDoc(id),{ownerUid:user.uid,invitedEmail,members:[user.uid],shared,updatedAt:serverTimestamp()});
  await setDoc(linkDoc(),{coupleId:id,updatedAt:serverTimestamp()});
  await attach(id);
  writeStatus("Invitation ready","Give your partner the invitation code shown below. Their account email must match "+invitedEmail+" and be verified.");
 }catch(e){writeStatus("Invite failed",tidyError(e))}
};
$("coupleJoinInvite").onclick=async()=>{
 if(!user)return writeStatus("Sign in needed","Sign in under Settings first.");
 const id=$("coupleInviteCode").value.trim().toLowerCase().replaceAll("-","");
 if(!/^[a-f0-9]{32}$/.test(id))return writeStatus("Invalid code","Enter the full private 32-character invitation code.");
 try{
  await reload(user);await getIdToken(user,true);
  if(!user.emailVerified)return writeStatus("Verify email","First tap Verify my email, open the email from Firebase, then tap Check verification.");
  writeStatus("Joining","Checking your private invitation…");
  const snapshot=await getDoc(pairDoc(id));if(!snapshot.exists())throw Error("No invitation found for that code.");
  const record=snapshot.data();
  if(record.invitedEmail!==user.email?.toLowerCase())throw Error("This invitation was addressed to another email.");
  if(!valid(record.shared))throw Error("The shared record is invalid.");
  if(record.members.includes(user.uid)){await setDoc(linkDoc(),{coupleId:id,updatedAt:serverTimestamp()});await attach(id);return}
  if(record.members.length!==1)throw Error("This shared space already has two members.");
  if(!confirm("Join this shared Couples space? Its existing goals, prayers, rewards and notes will replace the local Couples preview on this phone. Your private weight, workouts and measurements remain untouched."))return;
  await updateDoc(pairDoc(id),{members:[record.members[0],user.uid],updatedAt:serverTimestamp()});
  await setDoc(linkDoc(),{coupleId:id,updatedAt:serverTimestamp()});
  await attach(id);
  writeStatus("Connected together","Your Couples section is now shared and will stay updated across both phones.");
 }catch(e){writeStatus("Join failed",tidyError(e))}
};
$("coupleVerifyEmail").onclick=async()=>{
 if(!user)return writeStatus("Sign in needed","Sign in to send a verification message.");
 try{
  await reload(user);if(user.emailVerified)return writeStatus("Verified","Your email is already verified. Enter your invitation code and tap Join.");
  await sendEmailVerification(user);
  writeStatus("Check your inbox","We sent a verification message to "+user.email+". Open the link, then return and tap Check verification.");
 }catch(e){writeStatus("Verification issue",tidyError(e))}
};
$("coupleCheckVerify").onclick=async()=>{
 if(!user)return writeStatus("Sign in needed","Sign in under Settings first.");
 try{await reload(user);await getIdToken(user,true);writeStatus(user.emailVerified?"Email verified":"Not verified yet",user.emailVerified?"Enter the private invitation code and tap Join shared space.":"Open the email verification link first, then check again.")}
 catch(e){writeStatus("Verification issue",tidyError(e))}
};
$("coupleCopyInvite").onclick=async()=>{
 if(!coupleId)return;
 try{await navigator.clipboard.writeText(coupleId);writeStatus("Code copied","Send this private code directly to your partner. Don't post it publicly.")}
 catch(e){writeStatus("Copy manually","Select and copy the invitation code displayed below.")}
};
$("coupleLeaveDisplay").onclick=()=>{
 writeStatus("Connection details","This shared space links two accounts. The code can only be redeemed by the invited verified email.");
};
onAuthStateChanged(auth,current=>{
 if(unlisten){unlisten();unlisten=null}
 window.vigorCouplesSharedActive=false;
 clearTimeout(timer);user=current;coupleId=null;sharedReady=false;baseline=null;queued=false;
 void connectExisting();
});
