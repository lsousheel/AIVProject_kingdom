// DEVELOPMENT ONLY: real API handler + migration in a local PGlite test database.
// Authentication is a fixture. This does not prove hosted Supabase persistence/auth.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHandler} from '../api/feedback.js';
import {HttpError} from '../server/feedback.js';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
await db.exec(await fs.readFile(new URL('../supabase/migrations/001_feedback.sql',import.meta.url),'utf8'));
const saved=async()=> (await db.query('select * from public.kw_feedback order by created_at,id')).rows;
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5186';
let loseResponse=true, posts=0;
const store={
 rate:async()=>{},
 submit:async(value)=>{
   posts++;
   const hash=createHash('sha256').update(JSON.stringify(value.data)).digest('hex');
   const {rows}=await db.query('select public.kw_submit_feedback($1,$2,$3,$4,true) as result',[value.id,value.data,hash,'fixture-ip']);
   if(rows[0].result==='conflict')throw new HttpError(409,'Conflict');
   return {id:value.id};
 },
 login:async(email,password)=>{if(email!=='test-admin@example.invalid'||password!=='test-password')throw new HttpError(401,'Invalid sign in');return{access_token:'test-session',expires_in:3600};},
 authorize:async(token)=>{if(token!=='test-session')throw new HttpError(401,'Please sign in.');},
 logout:async()=>{},
 list:saved,
 note:async(id,notes)=>{await db.query('update public.kw_feedback set notes=$1 where id=$2',[notes,id]);},
};
const handler=createHandler({env:{SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-key',
 SUPABASE_ANON_KEY:'test-key',FEEDBACK_ADMIN_USER_ID:'test-admin',FEEDBACK_RATE_SALT:'x'.repeat(32),APP_ORIGIN:origin,FEEDBACK_TEST_MODE:'true'},storeFactory:()=>store});
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
async function setup(context){
 await context.route('**/api/feedback*',async route=>{
  const request=route.request(),headers={};let status=200,body;
  const res={setHeader:(k,v)=>headers[k]=v,set statusCode(v){status=v;},get statusCode(){return status;},end:v=>body=v};
  await handler({method:request.method(),url:request.url(),body:request.postData()||{},headers:await request.allHeaders(),socket:{remoteAddress:'test'}},res);
  if(request.method()==='POST'&&!request.url().includes('?')&&status===201&&loseResponse){loseResponse=false;return route.abort('failed');}
  await route.fulfill({status,headers,body});
 });
 await context.route('**/src/main.js*',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:await response.text()+'\nwindow.__qa={game,rts,renderer,intro,tutorial,feedback};'});
 });
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
}
async function step(p,id){await p.waitForFunction(id=>window.__qa.tutorial.state.step===id,id);}
async function ready(p){await p.goto(origin);await p.locator('.briefing-skip').click();await p.waitForFunction(()=>!__qa.intro.active);}
try{
 const player=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});await setup(player);
 const p=await player.newPage();await ready(p);await step(p,'objective');
 await p.locator('#tutorial-next').click();await step(p,'troops');
 await p.waitForTimeout(200);assert.equal(await p.locator('#tutorial-next').isVisible(),false);
 await p.locator('#balanced').click();await step(p,'formation');
 await p.locator('#formation').selectOption('wide');await step(p,'start');
 await p.locator('#start').click();await step(p,'select');
 await p.locator('[data-type="warrior"]').click();await step(p,'move');
 await p.waitForTimeout(1000);
 const position=await p.evaluate(()=>{const q=__qa,v=q.game.blue.center.clone().set(-30,0,8).project(q.rts.camera),r=q.renderer.domElement.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};});
 await p.mouse.click(position.x,position.y,{button:'right'});await step(p,'spacing');
 await p.locator('#rank-spacing').selectOption('loose');await step(p,'pause');
 await p.locator('#tutorial-next').click();await step(p,'camera');
 await p.locator('#tutorial-next').click();await step(p,'inspector');
 await p.locator('#tutorial-next').click();await step(p,'result');
 // Accelerate the real game rules to a result; do not fabricate participant data.
 await p.evaluate(()=>{__qa.game.command({x:38,z:4},{attackMove:true});__qa.game.blue.setSelected(true);__qa.game.command({x:38,z:4},{attackMove:true});for(let i=0;i<18000&&__qa.game.phase==='BATTLE';i++)__qa.game.update(1/60);});
 await p.waitForFunction(()=>['VICTORY','DEFEAT','DRAW'].includes(__qa.game.phase));
 await p.locator('#tutorial-next').click();
 assert.equal(await p.evaluate(()=>__qa.tutorial.state.status),'completed');
 await p.locator('#result-feedback').click();
 const form=p.locator('#feedback-form');
 await form.locator('[name="nickname"]').fill('DEV TEST — Zoë, "browser one"');
 for(const [name,value]of Object.entries({classmate:'Yes',controls:'8',problems:'Lag',objective:'Partly',help:'No'}))
  await form.locator('[name="'+name+'"]').selectOption(value);
 await form.locator('[name="confusing"]').fill('Nothing\nDevelopment test only');
 await form.locator('[name="tutorialHelpful"]').fill('Tutorial test — not participant evidence');
 await p.locator('#submit-feedback').click();
 await p.waitForFunction(()=>document.querySelector('#feedback-status').textContent.includes('Retry'));
 assert.equal((await saved()).length,1);
 await p.locator('#submit-feedback').click();
 await p.waitForFunction(()=>document.querySelector('#feedback-status').textContent.includes('Thank you'));
 assert.equal((await saved()).length,1);assert.equal(posts,2);
 assert.equal((await saved())[0].data.tutorialStatus,'completed');
 assert.equal((await saved())[0].data.tutorialStep,'result');
 await p.locator('#close-feedback').click();
 await p.reload();await p.locator('.briefing-skip').click();await p.waitForFunction(()=>!__qa.intro.active);
 assert.equal(await p.evaluate(()=>__qa.tutorial.active),false);
 await p.locator('#restart-tutorial').click();await p.locator('#tutorial-skip').click();
 assert.equal(await p.evaluate(()=>__qa.tutorial.state.status),'skipped');
 await p.reload();await p.locator('.briefing-skip').click();await p.waitForFunction(()=>!__qa.intro.active);
 assert.equal(await p.evaluate(()=>__qa.tutorial.active),false);
 await p.setViewportSize({width:390,height:844});
 await p.locator('#give-feedback').click();await p.screenshot({path:'tmp/verification/feedback-mobile.png'});
 assert.equal(await p.evaluate(()=>__qa.feedback.context.tutorialStatus),'skipped');
 const bounds=await p.locator('#feedback-dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391);
 await p.locator('#close-feedback').click();
 await p.setViewportSize({width:1440,height:900});
 await p.locator('#restart-tutorial').click();await p.locator('#tutorial-next').click();await p.locator('#balanced').click();
 await p.screenshot({path:'tmp/verification/tutorial-formation.png'});
 const [spot,target]=await Promise.all([p.locator('.tutorial-spot').boundingBox(),p.locator('#formation').boundingBox()]);
 assert.ok(Math.abs(spot.x-target.x)<2);
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(100);
 const mobileTarget=await p.locator('#formation').boundingBox(),mobileTip=await p.locator('.tutorial-tip').boundingBox();
 assert.ok(mobileTarget.x>=0&&mobileTarget.x+mobileTarget.width<=391,'highlighted formation stays visible after resize');
 assert.ok(mobileTip.x>=0&&mobileTip.x+mobileTip.width<=391,'instruction stays inside viewport');
 await p.screenshot({path:'tmp/verification/tutorial-mobile.png'});
 await p.locator('#formation').selectOption('line');await step(p,'start');
 await p.setViewportSize({width:1440,height:900});
 await p.locator('#start').click();await step(p,'select');
 // An early result bypasses unavailable steps instead of trapping the guide.
 await p.evaluate(()=>{__qa.game.phase='DRAW';});await step(p,'result');
 await p.locator('#tutorial-skip').click();
 await p.locator('#replay').click();
 await p.locator('#balanced').click();await p.locator('#start').click();await p.locator('#pause').click();
 await p.locator('#give-feedback').click();await p.locator('#close-feedback').click();
 assert.equal(await p.evaluate(()=>__qa.game.paused),true,'feedback preserves an existing pause');
 await p.locator('#restart-tutorial').click();await p.locator('#tutorial-next').click();await step(p,'select');
 await p.locator('[data-type="warrior"]').click();await step(p,'move');
 await p.keyboard.press('Escape');await step(p,'select');
 await p.locator('#reset').click();await step(p,'troops');await p.locator('#tutorial-skip').click();
 // Independent browser context has no player cookies or storage.
 const owner=await browser.newContext({viewport:{width:1200,height:900}});await setup(owner);
 const admin=await owner.newPage();await admin.goto(origin+'/admin/feedback');
 await admin.waitForFunction(()=>document.querySelector('#admin-status').textContent.includes('sign in'));
 assert.equal(await admin.locator('#admin-content').isVisible(),false);
 await admin.locator('[name="email"]').fill('test-admin@example.invalid');
 await admin.locator('[name="password"]').fill('test-password');await admin.locator('#admin-login button').click();
 await admin.waitForSelector('#admin-responses article');
 assert.match(await admin.locator('#admin-stats').innerText(),/0 \/ 5 qualifying/);
 await admin.locator('#admin-responses textarea').fill('=Observation\nDevelopment test, assisted once');
 await admin.getByRole('button',{name:'Save notes'}).click();
 await admin.getByText('Notes saved.',{exact:true}).waitFor();
 await admin.reload();await admin.waitForSelector('#admin-responses article');
 assert.equal(await admin.locator('#admin-responses textarea').inputValue(),'=Observation\nDevelopment test, assisted once');
 const download=admin.waitForEvent('download');await admin.locator('#admin-export').click();
 const csvFile=await(await download).path();const exported=await fs.readFile(csvFile,'utf8');
 assert.ok(exported.startsWith('\uFEFF'));assert.ok(exported.includes('completed'));assert.ok(exported.includes('"\'=Observation'));
 await admin.locator('#admin-logout').click();await admin.waitForSelector('#admin-login');
 const denied=await admin.evaluate(async()=> (await fetch('/api/feedback?action=export')).status);assert.equal(denied,401);
 assert.deepEqual(errors,[]);
 console.log('PASS tutorial action flow, completion/reload/skip/restart, desktop spotlight, mobile form, lost-response retry without duplicate, independent admin context, notes refresh, CSV and logout protection. Local PostgreSQL test DB + fixture auth only, zero real participants.');
}catch(error){console.error('Browser errors:',errors);throw error;}finally{await browser.close();await db.close();}
