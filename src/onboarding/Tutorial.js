export const TUTORIAL_KEY = 'kingdom-wars-tutorial-v1';
export const STEPS = [
  ['objective','#field-status','Defeat all Red defenders to win. Choose your army, then give it orders.',''],
  ['troops','.troop-cards','Choose troops using these cards. You can add up to 30 soldiers.','deploy'],
  ['formation','#formation','Choose a formation. It changes where your troops stand before battle.','formation'],
  ['start','#start','Click Start War. Your troops will wait for your orders.','start'],
  ['select','.troop-cards','Select a troop class to command that group. You can also use 1, 2 or 3.','select'],
  ['move','#battlefield','Right-click open ground to move your selected troops. You can also click or drag a route on the ground.','move'],
  ['spacing','#rank-spacing','Choose Loose ranks to give soldiers more space, or switch back to Standard ranks.','spacing'],
  ['pause','#pause','Pause stops the battle. Click it again to resume. Space also pauses when you are not typing.',''],
  ['camera','#home','Use WASD or arrow keys to move the camera and scroll to zoom. Overview brings the whole map back into view.',''],
  ['inspector','#algorithmView','Algorithm View shows how A* chooses routes and Boids steers nearby soldiers. You can open it during play.',''],
  ['result','#outcome > div','Replay starts another battle. Give Feedback shares your experience, including anything that stopped you.',''],
];
export function readTutorial() {
  try { return JSON.parse(localStorage.getItem(TUTORIAL_KEY)) || {status:'not_started',step:''}; }
  catch {return {status:'not_started',step:''};}
}
const ended = phase => ['VICTORY','DEFEAT','DRAW'].includes(phase);
export class Tutorial {
  constructor({game,intro}) {
    this.game=game;this.intro=intro;this.state=readTutorial();this.active=false;
    this.autoPending=this.state.status==='not_started';
    this.help=document.createElement('button');this.help.id='restart-tutorial';this.help.textContent='Help / Tutorial';
    document.querySelector('.header-tools').append(this.help);
    this.help.onclick=()=>this.start();
    this.root=document.createElement('div');this.root.id='guided-tutorial';this.root.hidden=true;
    this.root.innerHTML='<div class="tutorial-spot" aria-hidden="true"></div><section class="tutorial-tip" role="region" aria-label="Guided tutorial"><small id="tutorial-progress"></small><p id="tutorial-text" aria-live="polite"></p><div><button id="tutorial-next">Next</button><button id="tutorial-resume" hidden>Resume battle</button><button id="tutorial-focus">Focus highlighted control</button><button id="tutorial-skip">Skip tutorial</button></div></section>';
    document.body.append(this.root);
    this.tip=this.root.querySelector('.tutorial-tip');this.spot=this.root.querySelector('.tutorial-spot');
    this.root.querySelector('#tutorial-next').onclick=()=>this.advance();
    this.root.querySelector('#tutorial-skip').onclick=()=>this.finish('skipped');
    this.root.querySelector('#tutorial-focus').onclick=()=>this.focusTarget();
    this.root.querySelector('#tutorial-resume').onclick=()=>{game.paused=false;};
    this.onLayout=e=>{
      if(e?.type==='resize')this.target?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      this.layout();
    };
    this.buttons = [...this.root.querySelectorAll('button')].map(el=>[el,el.onclick]);
  }
  snapshot() {return {tutorialStatus:this.state.status,tutorialStep:this.state.step};}
  save() {try {localStorage.setItem(TUTORIAL_KEY,JSON.stringify(this.state));}catch{/* private mode */}}
  start() {
    if(this.intro.active) {this.autoPending=true;return;}
    if(this.game.phase==='DEMONSTRATION') {this.game.exitDemo();}
    this.autoPending=false;this.active=true;this.index=ended(this.game.phase)?10:0;
    this.state={status:'in_progress',step:STEPS[this.index][0]};this.save();
    this.root.hidden=false;
    for(const [el,handler] of this.buttons)el.onclick=handler;
    window.addEventListener('resize',this.onLayout);
    document.addEventListener('scroll',this.onLayout,true);
    this.render(true);
  }
  finish(status) {
    this.active=false;this.autoPending=false;this.state.status=status;this.save();
    this.root.hidden=true;this.clearHighlight();
    window.removeEventListener('resize',this.onLayout);
    document.removeEventListener('scroll',this.onLayout,true);
    for(const [el] of this.buttons)el.onclick=null;
    this.help.focus();
  }
  clearHighlight() {
    this.target?.classList.remove('tutorial-target');
    this.target=null;this.spot.hidden=true;
  }
  action(name) {
    if(!this.active || this.suspended || this.intro.active || this.game.phase==='DEMONSTRATION') return;
    if(STEPS[this.index][3]===name) this.advance();
  }
  advance() {
    if(!this.active) return;
    if(this.index===10) {
      if(ended(this.game.phase)) this.finish('completed');
      return;
    }
    this.index++;
    if(this.game.phase==='BATTLE' && this.index<4) this.index=4;
    this.render(true);
  }
  render(focus=false) {
    this.clearHighlight();
    const [id,selector,text,event]=STEPS[this.index];
    this.state.step=id;this.save();
    this.root.querySelector('#tutorial-progress').textContent='Step '+(this.index+1)+' of '+STEPS.length;
    const waiting=id==='result'&&!ended(this.game.phase);
    this.root.querySelector('#tutorial-text').textContent=waiting
      ? 'Keep playing. At the result screen we will show Replay and Give Feedback. You can give feedback now using the toolbar, even if you get stuck.' : text;
    this.root.querySelector('#tutorial-next').hidden=!!event||waiting;
    this.root.querySelector('#tutorial-next').textContent=id==='result'?'Finish tutorial':'Next';
    this.root.querySelector('#tutorial-focus').hidden=waiting;
    if(!waiting) {
      this.target=document.querySelector(selector);
      if(id==='spacing') document.getElementById('rank-order').hidden=false;
      this.target?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      this.target?.classList.add('tutorial-target');
    }
    this.layout();
    if(focus) (event ? this.root.querySelector('#tutorial-focus') : this.root.querySelector('#tutorial-next')).focus({preventScroll:true});
  }
  focusTarget() {
    const el=this.target?.matches('button,input,select,canvas')?this.target:this.target?.querySelector('button:not(:disabled),select');
    el?.focus({preventScroll:true});
  }
  get holding() {
    return this.active&&!this.suspended&&!this.intro.active&&this.game.phase!=='DEMONSTRATION'&&[0,7,8,9].includes(this.index);
  }
  update(suspended=false) {
    this.suspended=suspended;
    if(this.autoPending&&!this.intro.active&&!suspended) this.start();
    if(!this.active) return;
    this.root.hidden=suspended||this.intro.active;
    if(this.root.hidden) return;
    if(this.inDemo&&this.game.phase!=='DEMONSTRATION')this.render(true);
    this.inDemo=this.game.phase==='DEMONSTRATION';
    if(ended(this.game.phase)&&this.index!==10) {this.index=10;this.render(true);}
    if(this.game.phase==='PREPARATION'&&(this.index>=4||([2,3].includes(this.index)&&!this.game.blue))) {this.index=this.game.blue?2:1;this.render(true);}
    if(this.game.phase==='DEMONSTRATION') {
      this.clearHighlight();
      this.root.querySelector('#tutorial-text').textContent='Return to preparation to continue the battle tutorial. This demonstration has no combat.';
      this.root.querySelector('#tutorial-next').hidden=true;
      this.target=document.getElementById('exitDemo');this.target?.classList.add('tutorial-target');
    }
    if(this.game.phase==='BATTLE'&&[5,6].includes(this.index)&&
      (!this.game.blue?.selected||!this.game.blue.members(this.game.blue.selectedGroup).length)) {this.index=4;this.render(true);}
    const resultNow=ended(this.game.phase);
    if(this.index===10&&this.lastResult!==resultNow){this.render(true);}
    this.lastResult=resultNow;
    this.root.querySelector('#tutorial-resume').hidden=!(this.game.paused&&[4,5,6,10].includes(this.index)&&!resultNow);
    this.layout();
  }
  layout() {
    if(!this.active||this.root.hidden) return;
    const r=this.target?.getBoundingClientRect();
    this.spot.hidden=!r||!r.width||!r.height;
    const width=Math.min(330,innerWidth-24);
    this.tip.style.width=width+'px';
    if(r) {
      Object.assign(this.spot.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    }
    const height=this.tip.offsetHeight;
    // Prefer above or below the control; a battlefield-sized target leaves a side area.
    let x=12,y=12;
    if(r) {
      x=Math.max(12,Math.min(innerWidth-width-12,r.left));
      if(r.top>=height+20) y=r.top-height-12;
      else if(innerHeight-r.bottom>=height+20) y=r.bottom+12;
      else if(r.left>=width+20) {x=r.left-width-12;y=90;}
      else {x=Math.min(innerWidth-width-12,r.right+12);y=90;}
    } else y=innerHeight-height-20;
    Object.assign(this.tip.style,{left:Math.max(12,x)+'px',top:Math.max(8,Math.min(innerHeight-height-8,y))+'px'});
  }
}
