import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateFeedback,csv,stats,createStore} from '../server/feedback.js';
import {createHandler} from '../api/feedback.js';

export const example=()=>({id:randomUUID(),nickname:'DEV TEST — do not count',classmate:'Yes',controls:8,
 confusing:'Nothing',problems:'None',objective:'Yes',help:'No',tutorialStatus:'completed',tutorialStep:'result',
 phase:'VICTORY',build:'development-test',browser:'Test browser',viewport:'1440 × 900'});
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',
 SUPABASE_ANON_KEY:'anon',FEEDBACK_ADMIN_USER_ID:'admin',FEEDBACK_RATE_SALT:'x'.repeat(32),APP_ORIGIN:'https://game.example'};
export async function invoke(handler,{method='POST',action='',body={},cookie='',origin=env.APP_ORIGIN}={}){
 const headers={};let text;
 const res={statusCode:200,setHeader:(k,v)=>headers[k]=v,end:v=>text=v};
 await handler({method,url:'/api/feedback'+action,body,headers:{origin,cookie,'content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'}},res);
 return {status:res.statusCode,headers,text,data:()=>JSON.parse(text)};
}
test('server validation enforces required fields, rating bounds, enums and text caps',()=>{
 assert.equal(validateFeedback(example()).data.controls,8);
 for(const patch of [{controls:0},{controls:11},{controls:1.5},{controls:'8'},{nickname:''},{confusing:''},
  {confusing:'a'.repeat(2001)},{problems:'unknown'},{website:'spam'},{tutorialStatus:'invented'},{id:'abc'}])
  assert.throws(()=>validateFeedback({...example(),...patch}));
});
test('CSV preserves quotes/newlines/UTF-8 and neutralizes formula prefixes including whitespace',()=>{
 const row={id:randomUUID(),created_at:'2026-11-23T12:00:00Z',is_test:true,data:validateFeedback(example()).data,notes:' =HYPERLINK("bad")'};
 row.data.nickname='Zoë, "Tester"';row.data.confusing='First line\nSecond line';row.data.improvement='\t+cmd';
 const output=csv([row]);
 assert.ok(output.startsWith('\uFEFF"Response ID"'));
 assert.ok(output.includes('"Zoë, ""Tester"""'));assert.ok(output.includes('"First line\nSecond line"'));
 assert.ok(output.includes('"\' =HYPERLINK(""bad"")"'));assert.ok(output.includes('"\'\t+cmd"'));
 assert.ok(output.includes('Tutorial status'));assert.ok(output.includes('Private observation notes'));
});
test('qualifying counts exclude tests and use latest response for each nickname',()=>{
 const row=(nickname,rating,is_test=false)=>({data:{nickname,controls:rating,classmate:'Yes'},is_test});
 assert.deepEqual(stats([row('A',4),row(' a ',8),row('B',6),row('test',10,true)]),
  {responses:3,qualifying:2,average:7,tests:1});
});
test('API protects reads, exports and notes; checks origin; keeps credentials out of responses',async()=>{
 const store={authorize:async token=>{if(token!=='good'){const e=new Error('Please sign in.');e.status=401;throw e;}},
 list:async()=>[],note:async()=>{},rate:async()=>{},login:async()=>({access_token:'good',expires_in:3600}),logout:async()=>{}};
 const handler=createHandler({env,storeFactory:()=>store});
 for(const request of [{method:'GET'},{method:'GET',action:'?action=export'},{method:'PATCH',body:{id:randomUUID(),notes:'x'}}])
  assert.equal((await invoke(handler,request)).status,401);
 assert.equal((await invoke(handler,{origin:'https://evil.example',body:example()})).status,403);
 const login=await invoke(handler,{action:'?action=login',body:{email:'admin@example.com',password:'secret'}});
 assert.equal(login.status,200);assert.match(login.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);assert.match(login.headers['Set-Cookie'],/Secure/);
 assert.ok(!login.text.includes('good'));assert.equal((await invoke(handler,{method:'GET',cookie:'kw_admin=good'})).status,200);
 assert.equal((await invoke(createHandler({env:{}}),{body:example()})).status,503);
});
test('store uses atomic persistent RPC for idempotency and no client test flag',async()=>{
 let captured;
 const store=createStore({...env,FEEDBACK_TEST_MODE:'true'},async(url,options)=>{
  captured={url,body:JSON.parse(options.body),headers:options.headers};
  return new Response('"duplicate"');
 });
 const value=validateFeedback(example());
 assert.deepEqual(await store.submit(value,'hashed-ip'),{id:value.id});
 assert.ok(captured.url.endsWith('/rpc/kw_submit_feedback'));
 assert.equal(captured.body.p_test,true);assert.equal(captured.body.p_id,value.id);
 assert.equal(captured.headers.apikey,'server-only');
});
test('store rejects a valid non-owner account and paginates all responses',async()=>{
 const wrong=createStore(env,async()=>new Response(JSON.stringify({id:'not-admin'})));
 await assert.rejects(()=>wrong.authorize('valid-other-user'),e=>e.status===403);
 let calls=0;
 const paged=createStore(env,async()=>{
  calls++;return new Response(JSON.stringify(Array(calls===1?500:3).fill({id:'x'})));
 });
 assert.equal((await paged.list()).length,503);assert.equal(calls,2);
});
