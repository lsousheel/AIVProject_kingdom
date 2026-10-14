export const REVEAL_SECONDS = 4;
export const easeInOutCubic = t => t < 0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

// Borrow the existing camera without rebuilding the world or changing its controls.
export class IntroCameraTransition {
  constructor(rts) { this.rts = rts; }
  prepare(preparation) {
    const r = this.rts;
    this.end = { x: preparation ? 4 : r.focus.x, z: preparation ? 0 : r.focus.z, zoom: preparation ? 1.2 : r.zoom };
    this.start = { x: 18, z: -5, zoom: 2 };
    this.time = 0;
    r.keys.clear();
    this.apply(0);
  }
  apply(t) {
    const r = this.rts, amount = easeInOutCubic(Math.max(0,Math.min(1,t)));
    const mix = key => this.start[key] + (this.end[key]-this.start[key])*amount;
    r.focus.set(mix('x'),0,mix('z'));
    r.smoothFocus.copy(r.focus);
    r.zoom = r.smoothZoom = mix('zoom');
    r.update(0);
  }
  update(dt, duration = REVEAL_SECONDS) {
    this.time = Math.min(duration,this.time + dt);
    // First half-second fades the briefing before the camera descends.
    this.apply(Math.max(0,(this.time - Math.min(0.5,duration/4))/(duration-Math.min(0.5,duration/4))));
    return this.time >= duration;
  }
}
