import { briefingScenes } from './IntroContent.js';
import { IntroCameraTransition } from './IntroCameraTransition.js';
import './intro.css';

export class IntroSequence {
  constructor({ game, rts, canvas, onLayout = () => {} }) {
    this.game = game;
    this.canvas = canvas;
    this.onLayout = onLayout;
    this.app = document.getElementById('app');
    this.camera = new IntroCameraTransition(rts);
    this.scenes = briefingScenes();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.root = document.createElement('section');
    this.root.className = 'royal-briefing';
    this.root.setAttribute('role','dialog');
    this.root.setAttribute('aria-modal','true');
    this.root.setAttribute('aria-labelledby','briefing-title');
    this.root.innerHTML = `<div class="briefing-portrait"><img src="/assets/blue-king.png" alt="The Blue King overlooking the river and Red Keep in a blue lion cloak" fetchpriority="high"><div class="king-signature"><span>THE BLUE KINGDOM</span><b>A word from your king.</b></div></div><div class="briefing-body"><div class="briefing-masthead"><span>♜ &nbsp; KINGDOM WARS</span><span>THE SIEGE OF RED KEEP</span></div><div class="briefing-scroll"><div id="briefing-page"></div></div><nav class="briefing-navigation" aria-label="Briefing controls"><div class="briefing-progress" aria-label="Briefing progress"></div><div class="briefing-buttons"><button class="briefing-skip">Skip tutorial</button><button class="briefing-next">Next →</button></div></nav></div><div class="briefing-reveal" role="status">THE SIEGE OF RED KEEP<span>Take command.</span></div>`;
    document.body.append(this.root);
    this.nextButton = this.root.querySelector('.briefing-next');
    this.skipButton = this.root.querySelector('.briefing-skip');
    this.nextButton.onclick = () => this.next();
    this.skipButton.onclick = () => this.finish();
    this.replay = document.createElement('button');
    this.replay.textContent = 'Replay briefing';
    this.replay.onclick = () => this.open();
    document.querySelector('.header-tools').append(this.replay);
    this.onKey = e => {
      if (!this.active) return;
      // Capture before gameplay listeners: WASD, space and number keys must not
      // command the obscured battlefield. Native button activation stays intact.
      e.stopPropagation();
      if (this.exiting) { e.preventDefault(); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.finish(); }
      if (e.key === 'Tab') {
        const first = this.skipButton, last = this.nextButton;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown',this.onKey,true);
    this.open();
  }
  open() {
    if (this.active) return;
    this.active = true;
    this.exiting = false;
    this.page = 0;
    this.previousFocus = document.activeElement;
    this.app.inert = true;
    this.canvas.inert = true;
    this.root.hidden = false;
    this.root.classList.remove('is-leaving');
    document.body.classList.add('briefing-active');
    this.onLayout(true);
    this.camera.prepare(this.game.phase === 'PREPARATION');
    this.render();
  }
  render() {
    const scene = this.scenes[this.page];
    this.root.classList.toggle('final-order', this.page === this.scenes.length-1);
    this.root.querySelector('#briefing-page').innerHTML = `<small class="briefing-eyebrow">${scene.label}</small><h2 id="briefing-title">${scene.title.replace('\n','<br>')}</h2>${scene.content}`;
    this.root.querySelector('.briefing-scroll').scrollTop = 0;
    this.root.querySelector('.briefing-progress').innerHTML = `<span>${this.page+1} / ${this.scenes.length}</span><div aria-hidden="true">${this.scenes.map((_,i)=>`<i class="${i<=this.page?'reached':''}"></i>`).join('')}</div>`;
    this.nextButton.textContent = this.page === this.scenes.length-1 ? 'Begin the siege →' : 'Next →';
    this.nextButton.disabled = this.skipButton.disabled = false;
    this.root.querySelector('#briefing-page').animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:this.reducedMotion.matches?0:320});
    this.nextButton.focus();
  }
  next() {
    if (!this.active || this.exiting) return;
    if (this.page === this.scenes.length-1) this.finish();
    else { this.page++; this.render(); }
  }
  finish() {
    if (!this.active || this.exiting) return;
    this.exiting = true;
    this.nextButton.disabled = this.skipButton.disabled = true;
    this.root.classList.add('is-leaving');
  }
  update(dt) {
    if (!this.active || !this.exiting) return;
    if (!this.camera.update(dt,this.reducedMotion.matches ? 0.3 : 4)) return;
    this.active = false;
    this.exiting = false;
    this.root.hidden = true;
    this.app.inert = false;
    this.canvas.inert = false;
    document.body.classList.remove('briefing-active');
    this.onLayout(false);
    this.camera.apply(1);
    (this.previousFocus?.isConnected && this.previousFocus !== document.body ? this.previousFocus : this.replay).focus();
  }
  dispose() {
    document.removeEventListener('keydown',this.onKey,true);
    this.root.remove(); this.replay.remove();
    this.app.inert = this.canvas.inert = false;
    document.body.classList.remove('briefing-active');
  }
}
