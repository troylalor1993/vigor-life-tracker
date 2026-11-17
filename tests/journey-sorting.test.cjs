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
 view:'all',priorities:['h:3','h:1','h:0']};
const indices=arr=>Array.from(arr,x=>x.index);
const check=(name,fn)=>{fn();console.log('PASS',name)};
check('manual order preserves saved positions',()=>{
 assert.deepEqual(indices(sortHabits(habits,'manual',context)),[0,1,2,3,4]);
});
check('unfinished first preserves relative manual order',()=>{
 assert.deepEqual(indices(sortHabits(habits,'unfinished',context)),[1,3,4,0,2]);
});
check('needs attention uses enough logged opportunities, not guesses',()=>{
 assert.deepEqual(indices(sortHabits(habits,'attention',context)),[3,1,0,4,2]);
});
check('not-yet-recorded habits never rank as failed',()=>{
 const sorted=sortHabits(habits,'attention',context);
 assert(sorted.findIndex(h=>h.index===2)>sorted.findIndex(h=>h.index===0));
});
check('minimum efforts count as started for unfinished sorting',()=>{
 const sorted=sortHabits(habits,'unfinished',context);
 assert(sorted.findIndex(h=>h.index===2)>sorted.findIndex(h=>h.index===4));
});
check('focus manual follows exactly Today priority order',()=>{
 const focused=habits.filter(h=>[0,1,3].includes(h.index));
 assert.deepEqual(indices(sortHabits(focused,'manual',{...context,view:'focus'})),[3,1,0]);
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
