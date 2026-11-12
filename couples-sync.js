import { getApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, sendEmailVerification, reload, getIdToken } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
  writeStatus(record.members.length>=2?"Connected together":"Invitation ready",record.members.length>=2?"Shared goals and encouragements are updating across both accounts.":"Share the code with your partner. They must verify their email before joining.");
 },err=>writeStatus("Sync issue",tidyError(err)));
}
async function saveShared(){
 if(!active()||writing)return;
 if(!navigator.onLine){queued=true;writeStatus("Offline","Your changes are saved locally. Shared sync will retry when online.");return}
 writing=true;queued=false;
 try{
  const shared=readShared();if(!valid(shared))throw Error("Shared Couples data is invalid.");
  const sent=JSON.stringify(shared);
  writeStatus("Syncing","Saving the latest shared changes…");
  await updateDoc(pairDoc(coupleId),{shared,updatedAt:serverTimestamp()});
  baseline=sent;
  if(JSON.stringify(readShared())!==sent){queued=true;schedule()}
  else writeStatus("Saved together","Shared changes were saved to Firebase.");
 }catch(e){queued=true;writeStatus("Retry needed","Shared changes remain on this device. "+tidyError(e))}
 finally{writing=false}
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
  const shared=readShared();if(!valid(shared))throw Error("Couples data is not ready.");
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
 clearTimeout(timer);user=current;coupleId=null;sharedReady=false;baseline=null;queued=false;
 void connectExisting();
});
