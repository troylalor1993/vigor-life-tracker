// node tests/habit-archive.test.cjs
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=src.indexOf('function isHabitActive('),end=src.indexOf('function disciplineCounts(',start);
assert(start>=0&&end>start,'Archive logic not found');
const code=src.slice(start,end);
new vm.Script(code);
const state={
 habitLabels:['Read Bible','Pray','Nutrition'],
 dailyCheckins:{
  '2026-11-10':{saved:true,habits:[true,false,true]},
  '2026-11-11':{saved:true,habits:[false,true,false]},
  '2026-11-16':{saved:true,habits:[true,false,false]},
 },
 discipline:{
  settings:{0:{cue:'After breakfast',minimum:'One verse',kind:'build'},1:{cue:'After waking'}},
  minimums:{'2026-11-10':{1:true},'2026-11-11':{2:true}},
  big3:['h:0','h:1','w:a']
 }
};
let saves=0,renders=0;
const functions=new Function('state','save','renderDaily','render','renderSetup','disciplineConfig','iso',code+'; return {isHabitActive,habitWasTracked,setHabitArchived}');
const impl=functions(state,()=>{saves++;return true},()=>renders++,()=>renders++,()=>renders++,
()=>({cue:'Default cue',minimum:'Small action'}),()=> '2026-11-17');
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS',name)};
const before=JSON.stringify({labels:state.habitLabels,checks:state.dailyCheckins,mins:state.discipline.minimums});
check('initial habits active',()=>assert.equal(impl.isHabitActive(0),true));
check('archive removes habit from active selection',()=>{
 impl.setHabitArchived(0,true);
 assert.equal(impl.isHabitActive(0),false);
 assert.equal(state.discipline.settings[0].archivedAt,'2026-11-17');
});
check('archive removes linked daily priority only',()=>assert.deepEqual(state.discipline.big3,['h:1','w:a']));
check('archive preserves all check-ins and minimum records',()=>assert.equal(JSON.stringify({labels:state.habitLabels,checks:state.dailyCheckins,mins:state.discipline.minimums}),before));
check('dates before archive remain tracked',()=>assert.equal(impl.habitWasTracked(0,'2026-11-10'),true));
check('dates during archive do not count as habit opportunities',()=>assert.equal(impl.habitWasTracked(0,'2026-11-18'),false));
check('restore returns to active without replacing data',()=>{
 impl.setHabitArchived(0,false);
 assert.equal(impl.isHabitActive(0),true);
 assert.equal(JSON.stringify({labels:state.habitLabels,checks:state.dailyCheckins,mins:state.discipline.minimums}),before);
});
check('restore preserves archive interval history',()=>{
 assert.deepEqual(state.discipline.settings[0].archivePeriods,[{start:'2026-11-17',end:'2026-11-17'}]);
 assert.equal(impl.habitWasTracked(0,'2026-11-10'),true);
});
check('saved settings and other priorities survive',()=>{
 assert.equal(state.discipline.settings[0].cue,'After breakfast');
 assert.equal(state.discipline.settings[1].cue,'After waking');
 assert.deepEqual(state.discipline.big3,['h:1','w:a']);
});
check('archive reports failures without changing saved state',()=>{
 const failing=functions(state,()=>false,()=>{},()=>{},()=>{},()=>({cue:'Default'}),()=> '2026-11-20');
 const saved=JSON.stringify(state);
 assert.throws(()=>failing.setHabitArchived(0,true),/Could not save/);
 assert.equal(JSON.stringify(state),saved);
});
check('invalid index cannot archive another habit',()=>{
 const saved=JSON.stringify(state);
 assert.throws(()=>impl.setHabitArchived(999,true),/valid habit/);
 assert.equal(JSON.stringify(state),saved);
});
check('UI refresh requested after successful save',()=>{assert.equal(saves,2);assert.equal(renders,6)});
console.log(count+' archive safety checks passed.');
