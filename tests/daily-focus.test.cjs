// Run with node tests/daily-focus.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../daily-focus.js'),'utf8');
new vm.Script(source);
const begin=source.indexOf(' function focusFor(');
const end=source.indexOf(" window.VigorDailyFocus");
assert(begin>=0&&end>begin,'Could not extract focus logic');
const {focusFor}=vm.runInNewContext(source.slice(begin,end)+'\n({focusFor})');
const check=(name,run)=>{run();console.log('PASS',name)};
const day='2026-11-16';
const base={habitLabels:['Read Bible','Pray','Followed nutrition plan'],activities:[{id:'strength',name:'Strength',target:2}],discipline:{minimums:{},workoutMinimums:[],settings:{1:{minimum:'Pray one minute',cue:'After waking'}}},dailyCheckins:{},completions:[]};
check('default priorities use prayer, first workout and nutrition',()=>{
 const x=focusFor(base,day);
 assert.equal(x.total,3);assert.equal(x.next.name,'Pray');assert.equal(x.minimum,'Pray one minute');
});
check('configured priorities take precedence',()=>{
 const x=focusFor({...base,discipline:{...base.discipline,big3:['h:2','h:0','w:strength']}},day);
 assert.equal(x.next.name,'Followed nutrition plan');
});
check('minimum effort counts as started, not full',()=>{
 const x=focusFor({...base,discipline:{...base.discipline,minimums:{[day]:{1:true}}}},day);
 assert.equal(x.completed,1);assert.equal(x.next.name,'Strength');
});
check('workout completion counts as a priority',()=>{
 const x=focusFor({...base,completions:[{activityId:'strength',date:day}]},day);
 assert.equal(x.completed,1);
});
check('next action follows visible priority order even when workout is first',()=>{
 const d={...base,discipline:{...base.discipline,big3:['w:strength','h:1','h:2']}};
 const x=focusFor(d,day);
 assert.equal(x.next.name,'Strength');
 assert.deepEqual(Array.from(x.priorities),['w:strength','h:1','h:2']);
});
check('completed priority moves to the next selected item in order',()=>{
 const d={...base,discipline:{...base.discipline,big3:['w:strength','h:1','h:2']},
  completions:[{activityId:'strength',date:day}]};
 const x=focusFor(d,day);
 assert.equal(x.next.name,'Pray');
});
check('future workouts are not counted',()=>{
 const x=focusFor({...base,completions:[{activityId:'strength',date:'2026-11-17'}]},day);
 assert.equal(x.completed,0);
});
check('all priorities complete',()=>{
 const d={...base,dailyCheckins:{[day]:{habits:[true,true,true]}},completions:[{activityId:'strength',date:day}]};
 const x=focusFor(d,day);assert.equal(x.completed,3);assert.equal(x.allComplete,true);assert.equal(x.next,null);
});
check('empty tracker supports first-time state',()=>{
 const x=focusFor({habitLabels:[],activities:[],discipline:{},dailyCheckins:{}},day);
 assert.equal(x.total,0);assert.equal(x.allComplete,false);assert.equal(x.next,null);
});
console.log('Daily focus tests passed.');
