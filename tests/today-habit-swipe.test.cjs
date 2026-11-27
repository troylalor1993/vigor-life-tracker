// node tests/today-habit-swipe.test.cjs
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','today-habit-swipe.js'),'utf8');
new vm.Script(source);
const a=source.indexOf(' function todayHabits('),b=source.indexOf(" const anchor=$('transformationCoach')",a);
assert(a>=0&&b>a,'Could not extract Today habit list logic');
const {todayHabits}=vm.runInNewContext(source.slice(a,b)+'\n({todayHabits})');
const day='2026-11-17';
const data={habitLabels:['Read Bible','Pray','Read a book','Walk'],
 dailyCheckins:{[day]:{saved:true,habits:[true,false,false,false]}},
 discipline:{settings:{1:{minimum:'Pray one minute',cue:'After waking'},3:{archivedAt:day}},minimums:{[day]:{2:true}}}
};
const test=(name,fn)=>{fn();console.log('PASS',name)};
test('all active habits have a swipe card',()=>assert.equal(todayHabits(data,day).length,3));
test('archived habit absent without losing its saved record',()=>assert(!todayHabits(data,day).some(x=>x.index===3)));
test('unfinished habit comes before finished efforts',()=>assert.deepEqual(Array.from(todayHabits(data,day),x=>x.index),[1,0,2]));
test('full and minimum efforts stay visible and labelled',()=>{
 const result=todayHabits(data,day);
 assert.equal(result.find(x=>x.index===0).status,'full');
 assert.equal(result.find(x=>x.index===2).status,'min');
});
test('configured minimum and cue are displayed',()=>{
 const item=todayHabits(data,day).find(x=>x.index===1);
 assert.equal(item.minimum,'Pray one minute');assert.equal(item.cue,'After waking');
});
test('fresh empty day shows all active habits and no false completions',()=>{
 const items=todayHabits({...data,dailyCheckins:{},discipline:{...data.discipline,minimums:{}}},day);
 assert.equal(items.length,3);assert(items.every(x=>x.status==='none'));
});
test('no active habits is a valid empty state',()=>{
 const items=todayHabits({habitLabels:['Archived'],discipline:{settings:{0:{archivedAt:day}}}},day);
 assert.equal(items.length,0);
});
test('presentation order never changes underlying saved records',()=>{
 const before=JSON.stringify(data);
 todayHabits(data,day);assert.equal(JSON.stringify(data),before);
});
console.log('Today swipe regression checks passed.');
