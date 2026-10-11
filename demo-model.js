// Browser-only teaching model. This is not the firmware motion controller.
export const DEFAULTS = Object.freeze({
  screw: 2, motor: 200, micro: 16, encoder: 1500,
  minFeed: 2, maxFeed: 25, minAfeed: 20, maxAfeed: 400,
  backlash: 0, rapid: 600, accel: 10, decel: 30,
  motorGear: 50, screwGear: 50, simulator: 0, log: true
});
export const SETTINGS = [
  [['screw','SCREW PITCH','mm',.25,.25,50],['motor','MOTOR STEPS','',1,1,10000],['micro','MICROSTEP','',0,1,256],['encoder','ENC LINES','',1,1,100000]],
  [['minFeed','MIN FEED','mm/r',1,1,1000],['maxFeed','MAX FEED','mm/r',1,1,1000],['minAfeed','MIN AFEED','mm/min',10,1,10000],['maxAfeed','MAX AFEED','mm/min',10,1,10000]],
  [['backlash','BACKLASH','mm',.01,0,5],['rapid','RAPID','rpm',20,1,10000],['accel','ACCEL','us/step',1,1,1000],['decel','DECEL','us/step',1,1,1000]],
  [['motorGear','MOTOR GEAR','Z',1,1,1000],['screwGear','SCREW GEAR','Z',1,1,1000],['simulator','SIMULATOR','rpm',100,0,3000],['log','SD LOG','',0,0,1]]
];
const mm = [.2,.25,.3,.35,.4,.45,.5,.6,.7,.75,.8,1,1.25,1.5,1.75,2,2.5,3,3.5,4];
const tpi = [80,72,64,56,48,44,40,36,32,28,25,24,20,19,18,16,14,12,11,10,9,8,7,6,5,4];
export const THREADS = [
  ...mm.map(value=>({value,unit:'mm',pitch:value})),
  ...tpi.map(value=>({value,unit:'TPI',pitch:25.4/value})),
  ...[[28,'G 1/8'],[19,'G 1/4'],[14,'G 1/2'],[11,'G 1"']].map(([n,label])=>({value:label,unit:'',pitch:25.4/n}))
];
export const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
export const workMode = m=>['feed','afeed','thread','step','cycle'].includes(m);
export class DemoMachine {
  constructor(settings={}) {
    this.settings = {...DEFAULTS};
    // Restore only known, bounded numeric preferences, never browser-supplied code.
    for(const page of SETTINGS) for(const [key,, , ,lo,hi] of page) {
      if(key==='log') { if(typeof settings[key]==='boolean') this.settings[key]=settings[key]; }
      else if(Number.isFinite(settings[key])) this.settings[key]=clamp(settings[key],lo,hi);
    }
    this.mode='home'; this.page=0; this.row=0;
    this.edit={...this.settings}; this.setupNotice='';
    this.rpm=120; this.running=false; this.spinSign=1; this.turns=0;
    this.joy=0; this.microDir=0; this.rapidOn=false;
    this.z=0; this.actualZ=0; this.actualBacklash=.15; this.gap=0; this.lastCommand=-1;
    this.bf=false; this.left=null; this.right=null; this.feed=10; this.afeed=60;
    this.threadIndex=11; this.distance=2.5; this.index=0; this.target=null; this.stepDir=0;
    this.notice='CENTER JOY FIRST'; this.wait=3; this.cycleDir=0; this.cycleWait=0;
    this.divisions=6; this.divNotice=''; this.wizard=0; this.wizardReady=false;
    this.measured=0; this.code=''; this.regNotice='WEB PREVIEW ONLY';
    this.event='Выберите режим на экране прибора.'; this.zero=0;
    this.totalTravel=0; this.blocked=false;
  }
  get angle() { return ((this.turns%1)+1)%1*360; }
  get rpmNow() { return this.running?this.rpm:0; }
  get pitch() { return THREADS[this.threadIndex].pitch; }
  get feedMM() { return this.feed/100; }
  get busy() { return !!(this.joy||this.microDir||this.rapidOn||this.target!==null); }
  get idle() { return !this.busy&&!this.running; }
  get maxRPM() {
    const s=this.settings, hz=Math.min(s.rapid/60*s.motor*s.micro,1e6/30);
    return Math.floor(hz*.8*60*s.screw/(this.pitch*s.motor*s.micro*s.screwGear/s.motorGear));
  }
  get onMark() { const a=this.angle*this.divisions/360; return Math.abs(a-Math.round(a))*360/this.divisions<=.3; }
  open(mode) {
    this.setJoy(0); this.microDir=0; this.rapidOn=false;
    if(this.mode==='step') this.target=null;
    this.mode=mode;
    if(mode==='setup') { this.edit={...this.settings}; this.page=0; this.row=0; this.setupNotice=''; }
    if(mode==='step') { this.target=null; this.index=0; this.notice='CENTER JOY FIRST'; }
    if(mode==='wizard') { this.wizard=0; this.wizardReady=false; this.measured=0; }
    if(mode==='register') { this.code=''; this.regNotice='WEB PREVIEW ONLY'; }
    this.event='Открыт '+mode.toUpperCase()+'.';
  }
  exit() {
    if(['hw','touch','wizard','register'].includes(this.mode)) { this.mode='setup'; this.setJoy(0); this.microDir=0; }
    else this.open(this.mode==='step'?'afeed':'home');
  }
  choose(dir,repeat=0) {
    if(['thread','step'].includes(this.mode)&&this.busy) return;
    if(this.mode==='thread') this.threadIndex=(this.threadIndex+dir+THREADS.length)%THREADS.length;
    else if(this.mode==='step') this.distance=clamp(Math.round(this.distance*100)+dir*(repeat>30?100:repeat>10?10:1),1,1000000)/100;
    else if(this.mode==='afeed') {
      this.afeed+=dir*10;
      if(this.afeed<this.settings.minAfeed) this.afeed=this.settings.maxAfeed;
      if(this.afeed>this.settings.maxAfeed) this.afeed=this.settings.minAfeed;
    } else {
      this.feed+=dir;
      if(this.feed<this.settings.minFeed) this.feed=this.settings.maxFeed;
      if(this.feed>this.settings.maxFeed) this.feed=this.settings.minFeed;
    }
  }
  editSetting(dir,repeat=0) {
    const entry=SETTINGS[this.page]?.[this.row]; if(!entry) return;
    const [key,,,step,lo,hi]=entry, multiplier=repeat>40?20:repeat>15?5:1;
    if(key==='micro') { if(repeat<=3||repeat%8===1) this.edit[key]=clamp(this.edit[key]*(dir>0?2:.5),lo,hi); }
    else if(key==='log') this.edit.log=dir>0;
    else this.edit[key]=clamp(Math.round((this.edit[key]+dir*step*multiplier)*100)/100,lo,hi);
    this.edit.maxFeed=Math.max(this.edit.minFeed,this.edit.maxFeed);
    this.edit.maxAfeed=Math.max(this.edit.minAfeed,this.edit.maxAfeed);
    this.setupNotice='UNSAVED';
  }
  saveSettings() {
    if(!this.idle) { this.setupNotice='STOP FIRST'; this.event='Для SAVE остановите виртуальный шпиндель и отпустите органы управления.'; return false; }
    this.settings={...this.edit}; this.feed=clamp(this.feed,this.settings.minFeed,this.settings.maxFeed);
    this.afeed=clamp(this.afeed,this.settings.minAfeed,this.settings.maxAfeed);
    this.setupNotice='SAVED'; this.event='Настройки веб-версии сохранены в этом браузере.';
    if(this.settings.simulator) { this.rpm=this.settings.simulator; this.running=true; }
    return true;
  }
  motorMove(delta,countDRO=true) {
    if(!delta) return;
    if(delta>0) { const lost=Math.min(delta,this.actualBacklash-this.gap); this.gap+=lost; this.actualZ+=delta-lost; }
    else { const lost=Math.min(-delta,this.gap); this.gap-=lost; this.actualZ+=delta+lost; }
    if(countDRO) this.z+=delta;
    this.totalTravel+=Math.abs(delta);
  }
  prepare(dir) {
    if(this.bf&&dir!==this.lastCommand&&this.settings.backlash>0) {
      this.motorMove(dir*this.settings.backlash,false);
      this.event='BF: один выбор люфта по новой команде направления. DRO не считает компенсацию.';
    }
    this.lastCommand=dir;
  }
  setJoy(dir) {
    if(dir===this.joy) return;
    const old=this.joy; this.joy=dir; this.blocked=false;
    if(!dir) { this.cycleDir=0; this.cycleWait=0; if(this.mode==='step'&&this.target===null) this.notice='READY'; return; }
    if(this.mode==='hw') return;
    if(!workMode(this.mode)) { this.joy=0; this.event='Джойстик действует только в рабочих режимах.'; return; }
    if(this.mode==='step') {
      if(this.target!==null&&dir!==this.stepDir) { this.joy=0; this.notice='USE SAME DIR / EXIT'; return; }
      if(this.target===null) {
        const target=this.z+dir*this.distance;
        if((this.left!==null&&target<this.left-1e-6)||(this.right!==null&&target>this.right+1e-6)) {
          this.joy=0; this.notice='TARGET PAST LIMIT'; this.event='Цель STEP находится за лимитом.'; return;
        }
        this.target=target; this.stepDir=dir;
      }
      this.notice='MOVING';
    }
    if(this.mode==='cycle'&&(this.left===null||this.right===null||this.right<=this.left)) {
      this.joy=0; this.event='Для CYCLE установите два лимита: L левее R.'; return;
    }
    if(dir!==old) this.prepare(dir);
    this.cycleDir=dir;
  }
  toggleBF() {
    if(this.busy) { this.event='BF: BUSY. Сначала отпустите джойстик, микроподачу и RAPID.'; return; }
    this.bf=!this.bf; this.event='Компенсация BF '+(this.bf?'включена.':'выключена.');
  }
  toggleLimit(which) {
    if(this[which]!==null) { this[which]=null; this.event='Лимит '+(which==='left'?'L':'R')+' снят.'; return; }
    const other=which==='left'?this.right:this.left;
    if(other!==null&&(which==='left'?this.z>=other:this.z<=other)) {
      this.event='Лимит L должен находиться левее R.'; return;
    }
    this[which]=this.z; this.event='Лимит '+(which==='left'?'L':'R')+' установлен: '+(-(this.z-this.zero)||0).toFixed(2)+' мм.';
  }
  move(delta) {
    const requested=this.z+delta;
    const target=clamp(requested,this.left??-1e6,this.right??1e6);
    this.motorMove(target-this.z);
    if(Math.abs(target-requested)>1e-8) {
      this.blocked=true;
      this.event='Достигнут электронный лимит. Возврат возможен в противоположную сторону.';
      if(this.mode==='step') { this.target=null; this.notice='LIMIT - EXIT'; }
    }
  }
  microStart(dir) {
    if(this.mode==='hw') { this.microDir=dir; this.microTime=0; return; }
    if(!(workMode(this.mode)||this.mode==='wizard')||this.joy||this.target!==null) {
      this.event='Для микроподачи верните джойстик в нейтраль.'; return;
    }
    this.microDir=dir; this.microTime=0;
    if(this.mode!=='wizard') this.prepare(dir);
    this.microTick(.01*dir);
  }
  microTick(delta) {
    if(this.mode==='hw') return;
    if(this.mode==='wizard') {
      this.motorMove(delta,false);
      if(this.wizard===0&&delta>0&&this.gap>=this.actualBacklash-1e-6) this.wizardReady=true;
      if(this.wizard===2&&delta<0) this.measured+=-delta;
    } else this.move(delta);
  }
  rotate(delta) {
    this.turns+=delta;
    if(this.joy&&['feed','thread','cycle'].includes(this.mode)&&!this.microDir) {
      if(this.mode==='cycle'&&this.cycleWait>0) return;
      const dir=this.mode==='cycle'?this.cycleDir:this.joy;
      this.move(dir*delta*(this.mode==='thread'?this.pitch:this.feedMM));
    }
  }
  tick(dt) {
    if(this.running) {
      if(this.rapidOn&&this.joy&&['feed','thread'].includes(this.mode)) this.turns+=this.spinSign*this.rpm/60*dt;
      else this.rotate(this.spinSign*this.rpm/60*dt);
    }
    if(this.microDir) {
      this.microTime+=dt;
      if(this.microTime>.45) this.microTick(this.microDir*clamp((this.microTime-.45)*.4,.02,.8)*dt);
    }
    if(this.joy&&this.mode==='afeed') this.move(this.joy*(this.rapidOn?this.rapidMMmin:this.afeed)/60*dt);
    if(this.joy&&this.rapidOn&&['feed','thread'].includes(this.mode)) this.move(this.joy*this.spinSign*this.rapidMMmin/60*dt);
    if(this.mode==='step'&&this.joy&&this.target!==null) {
      const delta=this.target-this.z, travel=Math.min(Math.abs(delta),this.afeed/60*dt)*Math.sign(delta);
      this.move(travel);
      if(this.target!==null&&Math.abs(this.z-this.target)<1e-6) {
        this.target=null; this.index+=this.stepDir; this.notice='DONE - CENTER JOY';
        this.event='STEP завершён. Верните джойстик в нейтраль перед следующим перемещением.';
      }
    }
    if(this.mode==='cycle'&&this.joy&&this.blocked) { this.blocked=false; this.cycleWait=this.wait; this.cycleDir*=-1; this.prepare(this.cycleDir); }
    if(this.cycleWait>0) this.cycleWait=Math.max(0,this.cycleWait-dt);
  }
  get rapidMMmin() { return this.settings.rapid*this.settings.screw*this.settings.motorGear/this.settings.screwGear; }
  zeroDRO() {
    if(this.joy||this.microDir||this.target!==null) return false;
    if(this.mode==='divider') {this.turns=0;this.event='RAPID: угол делилки обнулён.';}
    else if(workMode(this.mode)) {this.zero=this.z;this.left=this.right=null;this.event='RAPID: DRO обнулён, оба электронных лимита сняты.';}
    else return false;
    return true;
  }
  stop() { this.running=false; this.setJoy(0); this.microDir=0; this.rapidOn=false; this.event='Виртуальное движение остановлено.'; }
}
