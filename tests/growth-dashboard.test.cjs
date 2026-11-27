// Run with: node tests/growth-dashboard.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','growth-dashboard.js'),'utf8');
new vm.Script(source);
const from=source.indexOf(' const todayKey=');
const to=source.indexOf(' window.VigorGrowth=');
assert(from>=0&&to>from,'Growth logic not found');
const {growthOverview}=vm.runInNewContext(source.slice(from,to)+'\n({growthOverview})');
const base={
 habitLabels:['Pray','Read a book','Work on business','Stretching'],
 dailyCheckins:{
  '2026-11-14':{saved:true,habits:[true,false,true,false]},
  '2026-11-15':{saved:true,habits:[false,true,false,false]}
 },
 discipline:{
  minimums:{'2026-11-15':{0:true,3:true}},restDays:{},
  reviews:{'2026-11-12':{win:'I read every day',obstacle:'Fatigue',adjustment:'Read after waking'}}
 }
};
const test=(name,fn)=>{fn();console.log('PASS',name)};
const overview=growthOverview(base,'2026-11-16');
test('four habits',()=>assert.equal(overview.habitCount,4));
test('two recorded non-rest days',()=>assert.equal(overview.recordedDays,2));
test('full efforts',()=>assert.equal(overview.full,3));
test('minimum efforts',()=>assert.equal(overview.minimum,2));
test('faith area',()=>assert(overview.groups.some(g=>g.name==='Faith'&&g.habits[0].label==='Pray')));
test('learning area',()=>assert(overview.groups.some(g=>g.name==='Learning')));
test('latest reflection',()=>assert.equal(overview.reflection.adjustment,'Read after waking'));
test('rest day excluded',()=>assert.equal(growthOverview({...base,discipline:{...base.discipline,restDays:{'2026-11-15':true}}},'2026-11-16').recordedDays,1));
test('unrecorded day excluded',()=>assert.equal(growthOverview({...base,dailyCheckins:{'2026-11-15':{saved:false,habits:[true,true,true,true]}}},'2026-11-16').full,0));
test('future reflection excluded',()=>assert.equal(growthOverview({...base,discipline:{...base.discipline,reviews:{'2026-12-01':{win:'future'}}}},'2026-11-16').reflection,null));
test('empty state works',()=>assert.equal(growthOverview({habitLabels:[],dailyCheckins:{},discipline:{}},'2026-11-16').groups.length,0));
console.log('Growth dashboard regression tests passed.');
