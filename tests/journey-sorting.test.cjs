// Run with node tests/journey-sorting.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','journey-manager.js'),'utf8');
new vm.Script(src);
const a=src.indexOf(' function sortHabits('),b=src.indexOf(' function render(){',a);
assert(a>=0&&b>a,'Could not locate the Journey sorting function');
const {sortHabits}=vm.runInNewContext(src.slice(a,b)+'\n({sortHabits})');
const habits=[
 {index:0,name:'Bible',rate:100,opportunities:5},
 {index:1,name:'Reading',rate:40,opportunities:5},
 {index:2,name:'Walk',rate:null,opportunities:0},
 {index:3,name:'Prayer',rate:20,opportunities:5},
 {index:4,name:'Stretch',rate:0,opportunities:1}
];
const context={full:[true,false,false,false,false],minimums:{2:true},
 view:'all'};
const indices=arr=>Array.from(arr,x=>x.index);
const check=(name,fn)=>{fn();console.log('PASS',name)};
check('manual order always moves recorded habits to the bottom, preserving order within groups',()=>{
 assert.deepEqual(indices(sortHabits(habits,'manual',context)),[1,3,4,0,2]);
});
check('unfinished first agrees with automatic unfinished priority',()=>{
 assert.deepEqual(indices(sortHabits(habits,'unfinished',context)),[1,3,4,0,2]);
});
check('marking a habit complete moves it to the bottom',()=>{
 const input={...context,full:[true,false,false,false,false],minimums:{}};
 const before=indices(sortHabits(habits,'manual',input));
 assert.deepEqual(before,[1,2,3,4,0]);
 input.full[1]=true;
 const after=indices(sortHabits(habits,'manual',input));
 assert.deepEqual(after,[2,3,4,0,1]);
});
check('minimum effort moves a habit to the bottom just like full completion',()=>{
 const input={...context,full:[],minimums:{3:true}};
 assert.deepEqual(indices(sortHabits(habits,'manual',input)),[0,1,2,4,3]);
});
check('needs attention uses enough logged opportunities, not guesses',()=>{
 assert.deepEqual(indices(sortHabits(habits,'attention',context)),[3,1,4,0,2]);
});
check('not-yet-recorded habits never rank as failed',()=>{
 const sorted=sortHabits(habits,'attention',context);
 assert(sorted.findIndex(h=>h.index===2)>sorted.findIndex(h=>h.index===0));
});
check('minimum efforts count as started for unfinished sorting',()=>{
 const sorted=sortHabits(habits,'unfinished',context);
 assert(sorted.findIndex(h=>h.index===2)>sorted.findIndex(h=>h.index===4));
});
check('archived list stays in saved order regardless of sort choice',()=>{
 assert.deepEqual(indices(sortHabits(habits,'attention',{...context,view:'archived'})),[0,1,2,3,4]);
});
check('sorting leaves the actual habit objects untouched',()=>{
 const original=JSON.stringify(habits),originalContext=JSON.stringify(context);
 sortHabits(habits,'attention',context);
 assert.equal(JSON.stringify(habits),original);
 assert.equal(JSON.stringify(context),originalContext);
});
check('missing metrics and no logged records do not throw',()=>{
 assert.deepEqual(indices(sortHabits([{index:0},{index:1}], 'attention',{})),[0,1]);
});
console.log('Journey sorting regression tests passed.');
