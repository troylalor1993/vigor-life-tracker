// Browser-level smoke tests for the Vigor Life premium experience.
// Run after installing Playwright + Chromium: node tests/ui-smoke.test.cjs
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const p=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain'}).end(data)
 });
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
   for(const viewport of [{width:390,height:844},{width:1280,height:800}]){
     const context=await browser.newContext({viewport});
     const page=await context.newPage();
     const errors=[];
     page.on('pageerror',err=>errors.push(err.message));
     await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded'});
     await page.locator('#vigorNav').waitFor({state:'visible',timeout:12000});
     assert.equal(await page.locator('#vigorNav [data-vigor-route]').count(),5,'five primary destinations');
     assert.equal(await page.locator('#big3Panel').isVisible(),true,'Today priorities visible');
     assert.equal(await page.locator('#vigorDailyFocus').isVisible(),true,'Next Small Win hero visible');
     assert.equal(await page.locator('#vigorStartGuide').isVisible(),true,'First-run guide visible without saved history');
     await page.locator('#vigorDailyFocus button').click();
     assert.equal(await page.locator('#big3Panel').isVisible(),true,'Next Small Win action leads to priorities');
     await page.locator('#vigorNav [data-vigor-route="journey"]').click();
     assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),true,'Dedicated Journey view visible');
     assert.equal(await page.locator('#vigorJourneyScreen .vigor-step').count(),5,'Five guided habit steps');
     assert.equal(await page.locator('#panel-today').isVisible(),false,'Today panel hidden while in Journey');
     await page.locator('#vigorNav [data-vigor-route="growth"]').click();
     assert.equal(await page.locator('#vigorPersonalGrowth').isVisible(),true,'Growth visible');
     assert.equal(await page.locator('#vigorRotationRecap').isVisible(),true,'Rotation recap visible in Growth');
     await page.locator('#vigorNav [data-vigor-route="fitness"]').click();
     assert.equal(await page.locator('#vigorFitnessScreen').isVisible(),true,'Dedicated Fitness screen visible');
     assert.equal(await page.locator('#vigorFitnessOpen').isVisible(),true,'Workout checklist action visible');
     await page.locator('#vigorNav [data-vigor-route="more"]').click();
     assert.equal(await page.locator('#vigorMoreMenu').isVisible(),true,'More menu visible');
     await page.locator('#vigorMoreMenu [data-vigor-old="faith"]').click();
     assert.equal(await page.locator('#panel-faith').isVisible(),true,'Faith remains reachable');
     await page.locator('#vigorNav [data-vigor-route="today"]').click();
     assert.equal(await page.locator('#big3Panel').isVisible(),true,'Return to Today');
     assert.equal(await page.locator('#vigorJourneyScreen').isVisible(),false,'Journey hidden when returning Today');
     const bounds=await page.locator('#vigorNav').boundingBox();
     assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=viewport.width+2,'navigation fits screen');
     assert(!errors.some(e=>/Cannot read properties of undefined|SyntaxError|ReferenceError/.test(e)),errors.join('; '));
     console.log('PASS app navigation and screens at '+viewport.width+'x'+viewport.height);
     await context.close();
   }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(err=>{console.error(err);process.exitCode=1;server.close()});
