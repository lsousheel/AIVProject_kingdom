import './feedback.css';
const KEY='kingdom-wars-feedback-draft-v1';
const build=typeof __BUILD_ID__==='undefined'?'local-development':__BUILD_ID__;
const select=(name,label,options)=>`<label>${label}<select name="${name}" required><option value="">Choose…</option>${options.map(v=>'<option>'+v+'</option>').join('')}</select></label>`;
const area=(name,label,max,required=false)=>`<label>${label}<textarea name="${name}" maxlength="${max}" ${required?'required':''} rows="2"></textarea></label>`;
export class Feedback {
  constructor({game,tutorial,rts}) {
    this.game=game;this.tutorial=tutorial;this.rts=rts;this.pending=null;
    this.button=document.createElement('button');this.button.id='give-feedback';this.button.textContent='Give Feedback';
    document.querySelector('.header-tools').append(this.button);this.button.onclick=()=>this.open();
    this.invite=document.createElement('section');this.invite.id='feedback-invite';this.invite.hidden=true;
    this.invite.innerHTML='<p>How was your battle? Your feedback helps improve Kingdom Wars.</p><button id="result-feedback">Give Feedback</button> <button id="dismiss-feedback">Not now</button>';
    document.querySelector('#outcome > div').append(this.invite);
    this.invite.querySelector('#result-feedback').onclick=()=>this.open();
    this.invite.querySelector('#dismiss-feedback').onclick=()=>{this.invite.hidden=true;this.dismissed=true;};
    this.dialog=document.createElement('dialog');this.dialog.id='feedback-dialog';this.dialog.setAttribute('aria-labelledby','feedback-heading');
    this.dialog.innerHTML=`<form id="feedback-form"><h2 id="feedback-heading">Help improve Kingdom Wars</h2>
      <p>About 2 minutes. Use a nickname if you prefer. Only the project owner can read these answers. Please avoid sensitive personal information. Questions marked * are required.</p>
      <label>Name or participant nickname *<input name="nickname" maxlength="80" required autocomplete="nickname"></label>
      ${select('classmate','Are you a classmate outside our project group? *',['Yes','No'])}
      ${select('controls','How intuitive were the controls? * (1 = very confusing, 10 = very easy)',Array.from({length:10},(_,i)=>String(i+1)))}
      ${area('confusing','What was the most confusing or frustrating part? * “Nothing” is fine.',2000,true)}
      ${select('problems','Did you notice lag or visual glitches? *',['None','Lag','Visual glitches','Both'])}
      ${area('problemContext','If you noticed a problem, what were you doing?',2000)}
      ${select('objective','Could you understand the objective from the instructions? *',['Yes','Partly','No'])}
      ${select('help','Did you need someone’s help to continue? *',['Yes','No'])}
      ${area('helpDetails','What help did you need? (optional)',1000)}
      ${area('improvement','What would you most like us to improve? (optional)',2000)}
      ${area('tutorialHelpful','Was the tutorial helpful? What was missing or unclear? (optional)',2000)}
      <label class="feedback-trap" aria-hidden="true">Leave blank<input name="website" tabindex="-1" autocomplete="off"></label>
      <p class="muted">We also record the time, build, game phase, tutorial progress, browser and viewport to understand problems. Your unfinished answers stay in this tab until sent or discarded.</p>
      <p id="feedback-status" role="status" aria-live="polite"></p>
      <div class="feedback-actions"><button type="submit" id="submit-feedback">Submit feedback</button><button type="button" id="close-feedback">Close</button><button type="button" id="discard-feedback">Discard draft</button></div>
      </form>`;
    document.body.append(this.dialog);this.form=this.dialog.querySelector('form');
    this.form.onsubmit=e=>{e.preventDefault();this.submit();};
    this.dialog.querySelector('#close-feedback').onclick=()=>this.close();
    this.dialog.querySelector('#discard-feedback').onclick=()=>{this.form.reset();this.pending=null;this.sent=false;this.lock(false);this.id=crypto.randomUUID();this.context=this.capture();try{sessionStorage.removeItem(KEY);}catch{}this.status('Draft discarded.');};
    this.form.oninput=()=>this.save();
    this.dialog.addEventListener('cancel',e=>{e.preventDefault();if(!this.busy)this.close();});
    this.dialog.addEventListener('keydown',e=>e.stopPropagation());
    this.restore();
  }
  get active(){return this.dialog.open;}
  capture(){return {phase:this.game.phase,build,viewport:`${innerWidth} × ${innerHeight}; DPR ${devicePixelRatio}`,
    browser:navigator.userAgent,level:this.game.levelName??'Original battlefield',...this.tutorial.snapshot()};}
  values(){const v=Object.fromEntries([...this.form.elements].filter(e=>e.name).map(e=>[e.name,e.value]));v.controls=Number(v.controls);return v;}
  save(){
    try{sessionStorage.setItem(KEY,JSON.stringify({values:this.values(),id:this.id,context:this.context,pending:this.pending}));}catch{}
  }
  restore(){
    try{const d=JSON.parse(sessionStorage.getItem(KEY));if(!d)return;
      for(const [k,v] of Object.entries(d.values||{})) if(this.form.elements[k])this.form.elements[k].value=v;
      this.id=d.id;this.context=d.context;this.pending=d.pending;
    }catch{}
  }
  status(s){this.dialog.querySelector('#feedback-status').textContent=s;}
  open(){
    if(this.active)return;
    this.wasPaused=this.game.paused;this.openPhase=this.game.phase;this.previousFocus=document.activeElement;
    this.game.paused=true;this.rts.keys.clear();
    this.id ||=crypto.randomUUID();this.context ||=this.capture();
    this.sent=false;this.lock(false);
    this.dialog.showModal();this.tutorial.update(true);
    this.form.elements.nickname.focus();
    if(this.pending)this.status('Your last request was not confirmed. Retry sends the same answers safely. Discard the draft to start over.');
    this.save();
  }
  close(){
    if(this.busy)return;
    this.save();this.dialog.close();
    if(this.game.phase===this.openPhase)this.game.paused=this.wasPaused;
    this.rts.keys.clear();this.tutorial.update(false);
    (this.previousFocus?.isConnected?this.previousFocus:this.button).focus();
  }
  async submit(){
    if(this.busy||!this.form.reportValidity())return;
    this.pending ||= {id:this.id,...this.values(),...this.context};
    this.save();this.busy=true;this.lock(true);this.status('Sending your feedback…');
    try{
      const response=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(this.pending),signal:AbortSignal.timeout(20000)});
      let result;try{result=await response.json();}catch{throw new Error('Feedback service is not available. Your answers are saved in this tab.');}
      if(!response.ok){
        if(response.status===400){this.pending=null;}
        throw new Error(result.error||'Could not submit. Please retry.');
      }
      this.status('Thank you! Your response was saved. Response ID: '+result.id);
      this.pending=null;this.form.reset();this.id=null;this.context=null;this.dismissed=true;this.invite.hidden=true;
      try{sessionStorage.removeItem(KEY);}catch{}
      this.sent=true;
    }catch(error){this.status((error.name==='TimeoutError'?'The request timed out.':error.message)+' Retry to confirm the same response; it will not be added twice.');}
    finally{this.busy=false;this.lock(false);this.dialog.querySelector('#submit-feedback').disabled=!!this.sent;this.save();}
  }
  lock(busy){
    for(const el of this.form.elements)el.disabled=busy;
    // Keep uncertain submissions immutable so a retry has exactly the same payload.
    if(!busy&&this.pending) for(const el of this.form.querySelectorAll('input,select,textarea'))el.disabled=true;
  }
  update(){
    const end=['VICTORY','DEFEAT','DRAW'].includes(this.game.phase);
    if(this.lastPhase!==this.game.phase){
      if(!end){this.dismissed=false;this.invite.hidden=true;}
      else if(!this.dismissed)this.invite.hidden=false;
      this.lastPhase=this.game.phase;
    }
  }
}
