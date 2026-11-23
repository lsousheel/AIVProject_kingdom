import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

test('migration enforces private access, idempotent retries, quotas and disk persistence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kingdom-feedback-test-'));
 let db=new PGlite(dir);
 try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/001_feedback.sql',import.meta.url),'utf8'));
  const id=randomUUID(),payload={nickname:'DEVELOPMENT TEST ONLY'};
  const insert=(id,hash='same')=>db.query('select public.kw_submit_feedback($1,$2,$3,$4,$5) as result',[id,payload,hash,'test-ip',true]);
  assert.equal((await insert(id)).rows[0].result,'created');
  assert.equal((await insert(id)).rows[0].result,'duplicate');
  assert.equal((await insert(id,'changed')).rows[0].result,'conflict');
  assert.equal((await db.query('select count(*) from public.kw_feedback')).rows[0].count,1);
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(()=>db.query('select * from public.kw_feedback'));
   await assert.rejects(()=>insert(randomUUID()));
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await db.query('select count(*) from public.kw_feedback')).rows[0].count,1);
  await db.query('update public.kw_feedback set notes=$1 where id=$2',['Development note',id]);
  for(let i=1;i<60;i++)assert.equal((await insert(randomUUID())).rows[0].result,'created');
  assert.equal((await insert(randomUUID())).rows[0].result,'limited');
  assert.equal((await insert(id)).rows[0].result,'duplicate','retry allowed even after quota');
  await db.exec('reset role');await db.close();
  db=new PGlite(dir);
  assert.equal((await db.query('select notes,is_test from public.kw_feedback where id=$1',[id])).rows[0].notes,'Development note');
  assert.equal((await db.query('select count(*) from public.kw_feedback')).rows[0].count,60);
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
});
