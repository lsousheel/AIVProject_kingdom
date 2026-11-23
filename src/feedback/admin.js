import './admin.css';
const login=document.getElementById('admin-login'),content=document.getElementById('admin-content'),status=document.getElementById('admin-status');
const labels={nickname:'Name / nickname',classmate:'Outside our project group',controls:'Controls rating (1–10)',
  confusing:'Confusing / frustrating part',problems:'Lag or visual glitches',problemContext:'What was happening',
  objective:'Understood objective',help:'Needed help',helpDetails:'Help explanation',improvement:'Requested improvement',
  tutorialHelpful:'Tutorial comments',tutorialStatus:'Tutorial status',tutorialStep:'Last tutorial step',
  phase:'Game phase when opened',build:'Build',browser:'Browser',viewport:'Viewport',level:'Level'};
function signedOut(){login.hidden=false;content.hidden=true;document.getElementById('admin-responses').replaceChildren();}
async function request(action='',options={}) {
  const r=await fetch('/api/feedback'+action,{...options,headers:{'Content-Type':'application/json',...options.headers},cache:'no-store'});
  if(!r.ok){let data;try{data=await r.json();}catch{}if(r.status===401||r.status===403)signedOut();throw new Error(data?.error||'Service unavailable. Please retry.');}
  return r;
}
function element(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function render({rows,stats}) {
  login.hidden=true;content.hidden=false;
  document.getElementById('admin-stats').textContent=`${stats.qualifying} / 5 qualifying classmates · Average controls rating: ${stats.average===null?'No ratings':stats.average.toFixed(1)+' / 10'} · ${stats.responses} non-test responses · ${stats.tests} development tests`;
  const list=document.getElementById('admin-responses');list.replaceChildren();
  if(!rows.length)list.append(element('p','No responses yet.'));
  for(const row of [...rows].reverse()){
    const article=document.createElement('article');
    article.append(element('h2',row.data.nickname+(row.is_test?' — DEVELOPMENT TEST':'')));
    article.append(element('p',row.created_at+' · '+row.id));
    const dl=document.createElement('dl');
    for(const [key,label] of Object.entries(labels)){dl.append(element('dt',label),element('dd',String(row.data[key]??'—')));}
    article.append(dl);
    const label=element('label','Private observation notes');
    const notes=document.createElement('textarea');notes.rows=3;notes.maxLength=5000;notes.value=row.notes||'';label.append(notes);article.append(label);
    const save=element('button','Save notes'),message=element('p','');message.setAttribute('role','status');article.append(save,message);
    save.onclick=async()=>{
      save.disabled=true;
      try{await request('',{method:'PATCH',body:JSON.stringify({id:row.id,notes:notes.value})});message.textContent='Notes saved.';}
      catch(e){message.textContent=e.message;status.textContent=e.message;}
      finally{save.disabled=false;}
    };
    list.append(article);
  }
}
async function refresh(){try{render(await(await request()).json());status.textContent='Responses loaded.';}catch(e){status.textContent=e.message;}}
login.onsubmit=async e=>{
  e.preventDefault();const button=login.querySelector('button');button.disabled=true;
  try{await request('?action=login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(login)))});login.elements.password.value='';await refresh();}
  catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
document.getElementById('admin-refresh').onclick=refresh;
document.getElementById('admin-logout').onclick=async()=>{
  try{await request('?action=logout',{method:'POST',body:'{}'});signedOut();status.textContent='Signed out.';}
  catch(e){signedOut();status.textContent=e.message;}
};
document.getElementById('admin-export').onclick=async()=>{
  try{
    const response=await request('?action=export');const url=URL.createObjectURL(await response.blob());
    const a=document.createElement('a');a.href=url;a.download='kingdom-wars-feedback.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){status.textContent=e.message;}
};
refresh();
