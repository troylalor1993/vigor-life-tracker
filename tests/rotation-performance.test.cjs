const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const context={window:{},document:{getElementById:()=>null}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../rotation-recap.js'),'utf8'),context);
const {trainingSummary,rotationSummary}=context.window.VigorRotationReview;
const start='2026-11-12';
test('empty rotation scores zero',()=>assert.equal(trainingSummary({},start).score,0));
test('named gym and home duplicates count once per day',()=>{
 const data={activities:[{id:'a',name:'Full Body A Gym'},{id:'b',name:'Full Body A Home'}],completions:[{date:start,activityId:'a'},{date:start,activityId:'b'},{date:'2026-11-20',activityId:'a'}]};
 assert.equal(trainingSummary(data,start).rows[0][1],1);
});
test('short workouts do not count as full',()=>assert.equal(trainingSummary({discipline:{workoutMinimums:[{date:start,activityId:'fullbody'}]}},start).rows[0][1],0));
test('historical targets override current targets',()=>{
 const data={trainingTargets:{strength:3},zone2Goal:90,trainingTargetHistory:{[start]:{strength:4,zone:150}}};
 const rows=trainingSummary(data,start).rows;
 assert.equal(rows[0][2],4);assert.equal(rows[3][2],150);
});
test('rotation boundary and capped score',()=>{
 assert.equal(rotationSummary({anchor:start},'2026-11-20').latest.start,start);
 assert.equal(trainingSummary({zone2Logs:[{date:start,minutes:300}]},start).score,17);
});
