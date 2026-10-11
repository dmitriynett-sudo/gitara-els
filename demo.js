import {DemoMachine, DEFAULTS, SETTINGS, THREADS, workMode, clamp} from './demo-model.js';
const $=id=>document.getElementById(id);
const STORAGE='gitara-web-v11-settings';
let restored={}; try { restored=JSON.parse(localStorage.getItem(STORAGE)||'{}')||{}; } catch {}
let machine=new DemoMachine(restored), sound=false, audio=null, gesture=null, microHeld=null,rapidHold=null;
const colors={white:'#f3f8f3',yellow:'#ffe500',green:'#33ff58',cyan:'#00e7ed',orange:'#ffa928',grey:'#303b36',blue:'#0737d7',red:'#d51920'};
const HELP={
  home:['ГЛАВНОЕ МЕНЮ','Выберите режим','Шесть кнопок — основные режимы прибора. STEP открывается из AFEED, диагностика и регистрация — из SETUP.','Здесь доступна полная веб-версия: все подачи, шаги резьбы и режимы открыты.'],
  feed:['FEED','Подача на оборот','Каретка проходит выбранное число миллиметров за оборот шпинделя. Включите джойстик и запустите шпиндель либо поверните его вручную.','Стрелки меняют подачу и во время движения. RAPID ускоряет в текущем направлении.'],
  afeed:['AFEED','Независимая подача','Скорость задаётся в мм/мин. Шпиндель может стоять: движение начинает джойстик. Скорость можно менять на ходу.','STEP вверху открывает перемещение на заданное расстояние.'],
  thread:['THREAD','Движение по резьбе','Выберите метрический шаг, TPI или трубную резьбу. Джойстик задаёт направление; вращение шпинделя ведёт каретку.','При активном джойстике стрелки выбора скрыты. MAX~ рассчитан по механике и RAPID; точный захват фазы веб-модель не воспроизводит.'],
  step:['STEP','Равные перемещения','Задайте расстояние кнопками −/+. Включение джойстика запускает одно перемещение на этот размер со скоростью AFEED.','После DONE верните джойстик в нейтраль. Если прервали шаг, продолжайте в том же направлении или выйдите в AFEED.'],
  cycle:['CYCLE','Между двумя лимитами','Каретка движется с синхронной подачей от L до R и обратно. На концах выдерживает паузу в секундах. Нужны оба лимита и вращение шпинделя.','Для быстрого знакомства выберите «Цикл между лимитами» в готовых примерах.'],
  divider:['DIVIDER','Деление оборота','Кнопки −/+ меняют число равных частей. Поворачивайте шпиндель вручную: при попадании на деление загорится ON MARK.','Включите звук на странице для сигнала. SAVE сохраняет число делений в текущей сессии.'],
  setup:['SETUP','Настройка механики','Нажмите строку, затем −/+ для изменения. NEXT переключает шесть страниц. SAVE применяет настройки при остановленном шпинделе и сохраняет их в браузере.','Настройки учебной модели не передаются на плату. EXIT без SAVE отбрасывает изменения.'],
  register:['REGISTER','Экран регистрации','На приборе здесь показан DEVICE ID, а восьмизначный код вводится цифровыми кнопками. Здесь отображается вымышленный ID.','Все функции веб-версии уже доступны. OK демонстрирует ввод и не проверяет настоящие коды.'],
  hw:['HW MONITOR','Виртуальные сигналы','Здесь можно посмотреть состояние виртуального энкодера, джойстика, микроподачи и RAPID. Все показания создаются браузером.','FIFO, ошибки и SD-карта не моделируются: этот экран не диагностирует настоящее оборудование.'],
  touch:['TOUCH TEST','Координаты нажатия','Нажимайте на сетку. Перекрестие покажет место нажатия в координатах экрана 320 × 240.','Это проверка кнопок веб-страницы. Она не калибрует сенсор реальной платы.'],
  wizard:['BACKLASH WIZARD','Мастер измерения люфта','Пройдите три шага кнопками NEXT и микроподачей. Справа отображается условный индикатор, как при настройке реального станка.','В учебной механике люфт равен 0,15 мм. На станке его измеряют своим индикатором; USE VALUE требует последующего SAVE.']
};
const SETTINGS_HELP={
  screw:'SCREW PITCH: шаг ходового винта продольной подачи в мм. Например, 1,50 / 2,00 / 3,00.',
  motor:'MOTOR STEPS: полных шагов двигателя на оборот, без микрошагов. Для двигателя 1,8° — 200.',
  micro:'MICROSTEP: деление шага, установленное на драйвере. Значение должно совпадать с переключателями драйвера.',
  encoder:'ENC LINES: линии энкодера, приведённые к обороту шпинделя. При шкивах: линии энкодера × зубья шкива шпинделя / зубья шкива энкодера.',
  minFeed:'MIN FEED: минимальная синхронная подача, мм на оборот шпинделя.',maxFeed:'MAX FEED: максимальная синхронная подача, мм на оборот шпинделя.',
  minAfeed:'MIN AFEED: минимальная независимая подача, мм/мин.',maxAfeed:'MAX AFEED: максимальная независимая подача, мм/мин.',
  backlash:'BACKLASH: измеренный люфт продольной оси. Здесь модель имеет условный люфт 0,15 мм; BF включается отдельно удержанием кнопки.',
  rapid:'RAPID: обороты шагового двигателя для быстрого хода. Через шаг винта и передаточное отношение они превращаются в скорость каретки.',
  accel:'ACCEL: насколько сокращается период импульсов за один шаг при разгоне независимого движения. Больше значение — быстрее разгон. Точный разгон здесь не моделируется.',
  decel:'DECEL: насколько увеличивается период импульсов за один шаг при торможении. Больше значение — быстрее торможение. Точное торможение здесь не моделируется.',
  motorGear:'MOTOR GEAR: число зубьев шестерни или шкива на двигателе.',screwGear:'SCREW GEAR: число зубьев шестерни или шкива на ходовом винте.',
  simulator:'SIMULATOR: встроенный в прошивку виртуальный шпиндель для проверки меню. В веб-версии весь шпиндель виртуальный.',
  log:'SD LOG: запись диагностического лога на карту в настоящем приборе. Веб-страница показывает переключение; файлов на SD она не пишет.'
};
function beep() {
  if(!sound) return;
  try { audio??=new (window.AudioContext||window.webkitAudioContext)(); if(audio.state==='suspended') audio.resume(); const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=1200;g.gain.value=.035;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.04); } catch {}
}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function text(x,y,label,size=16,color='white',anchor='middle') { return `<text x="${x}" y="${y}" fill="${colors[color]||color}" font-size="${size}" text-anchor="${anchor}" dominant-baseline="middle">${esc(label)}</text>`; }
function number(x,y,value,unit='',size=31,color='yellow') {
  return text(x,y,value,size,color)+(unit?text(x+String(value).length*size*.31+9,y+size*.24,unit,10,color,'start'):'');
}
let expectedButtons=[];
function button(id,label,rect,color,action,opts={}) { expectedButtons.push({id,label,rect,color,action,...opts}); }
function header(title) {button('exit','EXIT',[5,5,65,35],'red',()=>machine.exit());return text(machine.mode==='afeed'?110:160,23,title,16);}
function chooseButtons() {
  if(['thread','step'].includes(machine.mode)&&machine.busy) return text(35,112,machine.joy?'JOY ON':'BUSY',9,'yellow')+text(285,112,'LOCKED',9,'yellow');
  button('prev',machine.mode==='step'?'−':'‹',[5,85,60,55],'blue',n=>machine.choose(-1,n),{repeat:true,aria:'Уменьшить подачу или шаг'});
  button('next',machine.mode==='step'?'+':'›',[255,85,60,55],'blue',n=>machine.choose(1,n),{repeat:true,aria:'Увеличить подачу или шаг'});return '';
}
function settingValue(entry) {
  const [key]=entry,v=machine.edit[key];
  if(key==='log') return v?'ON':'OFF';if(key==='simulator'&&!v) return 'OFF';
  if(['screw','backlash'].includes(key))return v.toFixed(2);
  if(['minFeed','maxFeed'].includes(key))return (v/100).toFixed(2);return String(v);
}
function save() {
  if(machine.saveSettings()) {try {localStorage.setItem(STORAGE,JSON.stringify(machine.settings));}catch {machine.event='Настройки применены, но браузер не разрешил сохранить их после закрытия страницы.';} }
}
function screenMarkup() {
  const m=machine;expectedButtons=[];let out='';
  if(m.mode==='home') {
    const labels=['FEED','AFEED','THREAD','DIVIDER','CYCLE','SETUP'],modes=['feed','afeed','thread','divider','cycle','setup'];
    const cs=['#005f9c','#00827e','#bb0808','#7b168b','#bf7700','#303b36'];
    labels.forEach((label,i)=>button('home-'+i,label,[i%2?170:15,5+Math.floor(i/2)*55,135,45],cs[i],()=>m.open(modes[i])));
    out+='<path d="M10 173H310" stroke="#303b36"/>'+text(45,210,'TACHO',15,'yellow')+number(190,206,m.rpmNow,'RPM',39);
  } else if(m.mode==='setup') {
    out+=header('SETUP '+(m.page+1)+'/6');
    button('page','NEXT',[250,5,65,35],'blue',()=>{m.page=(m.page+1)%6;m.row=0;m.setupNotice='';});
    let rows;
    if(m.page<4) rows=SETTINGS[m.page].map(e=>({label:e[1],value:settingValue(e),unit:e[2]}));
    else if(m.page===4) rows=[{label:'HW MONITOR',value:'>'},{label:'BACKLASH WIZARD',value:'>'},{label:'TOUCH TEST',value:'>'},{label:'GITARA V11',value:''}];
    else rows=[{label:'REGISTRATION',value:'>'},{label:'STATUS',value:'WEB FULL'},{label:'BUILD',value:'WEB'}];
    rows.forEach((r,i)=>button('row-'+i,r.label,[5,48+i*36,310,34],'transparent',()=>{m.row=i;if(m.page===4&&i<3)m.open(['hw','wizard','touch'][i]);if(m.page===5&&i===0)m.open('register');},{row:true,selected:m.row===i,value:r.value,unit:r.unit||'',aria:r.label+': '+r.value+' '+(r.unit||'')}));
    if(m.page<4) {button('minus','−',[15,197,60,38],'orange',n=>m.editSetting(-1,n),{repeat:true,aria:'Уменьшить настройку'});button('plus','+',[85,197,60,38],'orange',n=>m.editSetting(1,n),{repeat:true,aria:'Увеличить настройку'});}
    button('save','SAVE',[220,197,95,38],'green',save);out+=text(183,216,m.setupNotice,8,'yellow');
  } else if(m.mode==='divider') {
    out+=header('DIVIDER');button('save','SAVE',[250,5,65,35],'green',()=>{m.divNotice=m.idle?'SAVED':'STOP FIRST';});
    out+=number(160,83,m.angle.toFixed(1)+'°','',44,m.onMark?'green':'yellow')+text(160,125,'MARK '+(Math.round(m.angle*m.divisions/360)%m.divisions+1)+' / '+m.divisions,16)+text(160,143,'DIVISIONS',9)+number(160,172,m.divisions,'',32,'cyan');
    button('minus','−',[5,146,55,44],'blue',n=>{m.divisions=clamp(m.divisions-(n>12?10:1),1,360);m.divNotice='UNSAVED';},{repeat:true,aria:'Уменьшить число делений'});
    button('plus','+',[260,146,55,44],'blue',n=>{m.divisions=clamp(m.divisions+(n>12?10:1),1,360);m.divNotice='UNSAVED';},{repeat:true,aria:'Увеличить число делений'});
    out+=text(160,197,m.divNotice,8,'yellow')+`<rect x="5" y="204" width="310" height="30" rx="5" fill="${m.onMark?colors.green:colors.grey}"/>`+text(160,220,m.onMark?'ON MARK':'TURN TO MARK',17,m.onMark?'#000':'white');
  } else if(m.mode==='register') {
    out+=header('REGISTER')+text(160,49,'DEVICE ID · FICTIONAL',8)+text(160,66,'WEB-PREVIEW-ONLY',23,'cyan')+text(160,93,m.code.padEnd(8,'_'),23,'yellow')+text(160,112,m.regNotice,9,'yellow');
    button('accept','OK',[250,5,65,35],m.code.length===8?'green':'grey',()=>{m.regNotice=m.code.length===8?'NO CODE CHECK IN WEB':'ENTER 8 DIGITS';m.event='Веб-версия не проверяет лицензию. Все меню уже доступны.';});
    ['1','2','3','DEL','4','5','6','CLR','7','8','9','0'].forEach((label,i)=>button('key-'+i,label,[5+(i%4)*79,120+Math.floor(i/4)*40,i%4===3?73:74,36],'blue',()=>{if(label==='DEL')m.code=m.code.slice(0,-1);else if(label==='CLR')m.code='';else if(m.code.length<8)m.code+=label;m.regNotice='WEB PREVIEW ONLY';}));
  } else if(m.mode==='hw') {
    out+=header('HW MONITOR');
    const ticks=Math.round(m.turns*m.settings.encoder*2),enc=((ticks%4)+4)%4;
    ['ENC A:'+Number(enc===1||enc===2)+' B:'+Number(enc>=2),'JOY L:'+Number(m.joy<0)+' R:'+Number(m.joy>0),'M L:'+Number(m.microDir<0)+' R:'+Number(m.microDir>0)+' FAST:'+Number(m.rapidOn),'TICKS:'+ticks,'FIFO:-- OV:--','dS:-- dM:--','SD LOG:'+(m.settings.log?'ON (VIRTUAL)':'OFF')].forEach((v,i)=>out+=text(10,62+i*25,v,14,'white','start'));
  } else if(m.mode==='touch') {
    out+=header('TOUCH TEST');for(let x=0;x<320;x+=20)out+=`<path d="M${x} 45V240" stroke="#303b36"/>`;for(let y=60;y<240;y+=20)out+=`<path d="M0 ${y}H320" stroke="#303b36"/>`;
    out+=text(160,57,'WEB TOUCH · 320 x 240',10,'cyan');if(touchPoint)out+=`<path d="M${touchPoint.x-6} ${touchPoint.y}h12 M${touchPoint.x} ${touchPoint.y-6}v12" stroke="#ffe500" stroke-width="2"/>`+text(160,222,'X:'+touchPoint.x+' Y:'+touchPoint.y,12,'yellow');
  } else if(m.mode==='wizard') {
    out+=header('BACKLASH');
    const lines=m.wizard===0?['1. Hold M> until','the dial moves right.','Then release M>.']:m.wizard===1?['2. Zero the dial.','Then press NEXT.']:['3. Hold M< until','dial moves 0.01 mm.','Release M<, use value.'];
    lines.forEach((line,i)=>out+=text(10,64+i*27,line,15,'white','start'));
    if(m.wizard===2)out+=number(150,155,Math.max(0,m.measured-.01).toFixed(2),'mm BL',26);
    button('wizard-next',m.wizard===2?'USE VALUE':'NEXT',[80,185,160,48],m.wizard===0&&!m.wizardReady?'grey':m.wizard===2?'green':'blue',()=>{if(m.microDir)return;if(m.wizard===0){if(m.wizardReady)m.wizard=1;}else if(m.wizard===1){m.wizard=2;m.measured=0;m.dialZero=m.actualZ;}else if(m.measured>=.01){m.edit.backlash=Math.round(Math.max(0,m.measured-.01)*100)/100;m.mode='setup';m.page=2;m.row=0;m.setupNotice='UNSAVED';}});
  } else if(workMode(m.mode)) {
    out+=header({feed:'SYNC FEED',afeed:'AFEED',thread:'THREAD',step:'STEP',cycle:'AUTO CYCLE'}[m.mode]);
    if(m.mode==='afeed')button('step-menu','STEP',[150,5,65,35],'orange',()=>{if(!m.busy)m.open('step');else m.event='Для перехода в STEP верните джойстик в нейтраль.';});
    button('bf','BF',[240,5,75,40],m.bf?'red':'grey',()=>m.toggleBF(),{hold:1200,aria:'BF — держать 1,2 секунды'});
    button('limit-left','L',[5,195,55,40],m.left!==null?'red':'grey',()=>m.toggleLimit('left'),{hold:2200,aria:'Лимит L — держать 2,2 секунды'});
    button('limit-right','R',[260,195,55,40],m.right!==null?'red':'grey',()=>m.toggleLimit('right'),{hold:2200,aria:'Лимит R — держать 2,2 секунды'});
    out+=chooseButtons()+number(148,217,(-(m.z-m.zero)||0).toFixed(2),'mm',27,'green');
    if(m.mode==='step')out+=text(160,57,'N:'+(-m.index)+'  F:'+m.afeed,15,'cyan')+number(153,109,m.distance.toFixed(2),'mm',31)+text(160,159,m.notice,13,'yellow')+text(160,182,m.target!==null?'RESUME SAME DIRECTION':'CENTER FOR NEXT STEP',10);
    else {
      const t=THREADS[m.threadIndex];const val=m.mode==='afeed'?m.afeed:m.mode==='thread'?typeof t.value==='number'?(t.unit==='mm'?t.value.toFixed(2):t.value):t.value:m.feedMM.toFixed(2);
      const unit=m.mode==='afeed'?'mm/min':m.mode==='thread'?t.unit:'mm/r';out+=number(151,109,val,unit,31);
      if(m.mode==='thread')out+=number(68,167,m.rpmNow,'RPM',23,m.rpmNow>m.maxRPM?'red':'cyan')+number(230,167,m.maxRPM,'MAX~',23,'orange');
      else if(m.mode==='cycle'){button('wait-minus','−',[5,150,60,35],'orange',()=>m.wait=clamp(Math.round((m.wait-.1)*10)/10,0,10),{repeat:true,aria:'Уменьшить паузу'});button('wait-plus','+',[255,150,60,35],'orange',()=>m.wait=clamp(Math.round((m.wait+.1)*10)/10,0,10),{repeat:true,aria:'Увеличить паузу'});out+=number(108,168,m.wait.toFixed(1),'s',23)+number(202,168,m.rpmNow,'RPM',17,'cyan');if(m.cycleWait>0)out+=text(160,55,'WAIT '+m.cycleWait.toFixed(1)+' s',10,'yellow');}
      else out+=text(38,167,'SPIN',15,'cyan')+number(185,167,m.rpmNow,'RPM',25,'cyan');
    }
  }
  return out;
}
let touchPoint=null,lastMarkup='',lastHelp='',lastEvent='',lastMark=null;
function syncButtons() {
  const root=$('screen-buttons'),ids=new Set(expectedButtons.map(b=>b.id));
  for(const el of root.children)if(!ids.has(el.dataset.id))el.remove();
  for(const b of expectedButtons) {
    let el=root.querySelector(`[data-id="${b.id}"]`);
    if(!el){el=document.createElement('button');el.type='button';el.dataset.id=b.id;root.append(el);}
    const [x,y,w,h]=b.rect;el.style.left=x/3.2+'%';el.style.top=y/2.4+'%';el.style.width=w/3.2+'%';el.style.height=h/2.4+'%';el.style.setProperty('--btn-color',colors[b.color]||b.color);
    el.className='screen-button'+(b.row?' row':'')+(b.selected?' selected':'')+(b.id==='bf'?' bf':'');
    el.setAttribute('aria-label',b.aria||b.label);el.setAttribute('title',b.hold?'Держите '+b.hold/1000+' с':b.aria||b.label);
    const html=b.row?`<span class="label" style="color:${b.selected?colors.yellow:colors.white}">${esc(b.label)}</span><span class="value" style="color:${b.selected?colors.yellow:colors.white};font-size:${b.value?.length>6?'4.1':'5.8'}cqw">${esc(b.value)}<small>${esc(b.unit)}</small></span>`:`<span class="label">${esc(b.label)}</span>`+(b.hold?'<span class="hold-progress"></span>':'');
    if(el.dataset.html!==html){el.innerHTML=html;el.dataset.html=html;}el._control=b;
  }
}
function render() {
  const markup=screenMarkup();if(markup!==lastMarkup){$('display').innerHTML=markup;lastMarkup=markup;}
  syncButtons();const m=machine,help=HELP[m.mode]||HELP.home;
  let detail=help[3];if(m.mode==='setup'&&m.page<4)detail=SETTINGS_HELP[SETTINGS[m.page][m.row][0]];
  if(m.mode==='wizard')detail='Условный индикатор: '+(m.actualZ-(m.dialZero||0)).toFixed(2)+' мм. '+help[3];
  const key=[...help,detail].join('|');if(key!==lastHelp){$('help-tag').textContent=help[0];$('help-title').textContent=help[1];$('help-text').textContent=help[2];$('help-detail').innerHTML='<p class="help-detail">'+esc(detail)+'</p>';lastHelp=key;}
  if(m.event!==lastEvent){$('event').textContent=m.event;lastEvent=m.event;}
  $('position').textContent=(-(m.z-m.zero)||0).toFixed(2).replace('.',',')+' мм';$('carriage').style.left=clamp(50+m.actualZ*2,0,100)+'%';
  for(const [name,value]of[['left',m.left],['right',m.right]]){const e=$('limit-'+name+'-marker');e.hidden=value===null;e.style.left=clamp(50+value*2,0,100)+'%';}
  $('travel-state').textContent=m.blocked?'Электронный лимит':m.cycleWait>0?'Пауза цикла':m.joy||m.microDir?'Каретка: '+(-(m.z-m.zero)||0).toFixed(2)+' мм':'Каретка стоит';
  document.querySelectorAll('[data-joy]').forEach(e=>e.setAttribute('aria-pressed',String(Number(e.dataset.joy)===m.joy)));
  $('spindle-toggle').textContent=m.running?'Остановить':'Запустить';$('spindle-reverse').setAttribute('aria-pressed',String(m.spinSign<0));$('rapid').setAttribute('aria-pressed',String(m.rapidOn));
  $('angle-label').textContent='Угол '+m.angle.toFixed(1).replace('.',',')+'°';$('spindle-icon').style.transform='rotate('+m.angle+'deg)';
  const mark=m.onMark&&m.mode==='divider';if(mark&&lastMark===false)beep();lastMark=mark;
}
function beginGesture(el,control,keyboard=false) {
  endGesture();beep();gesture={el,control,started:performance.now(),last:performance.now(),repeats:0,fired:false,keyboard};
  el.classList.add('pressed');if(!control.hold){control.action(0);gesture.fired=true;}else machine.event='Держите '+control.label+' '+control.hold/1000+' секунды до заполнения полосы.';render();
}
function endGesture(commit=false) {
  if(gesture){const g=gesture;
    // A background browser may throttle animation frames. Confirm elapsed time
    // again on release, without letting cancelled/outside gestures activate.
    if(commit&&g.control.hold&&!g.fired){if(performance.now()-g.started>=g.control.hold){g.fired=true;g.control.action();beep();}else machine.event='Короткое нажатие. Для '+g.control.label+' держите кнопку '+g.control.hold/1000+' секунды.';}
    g.el.classList.remove('pressed');const progress=g.el.querySelector('.hold-progress');if(progress)progress.style.width='0';
  }gesture=null;
}
$('screen-buttons').addEventListener('pointerdown',e=>{if(e.button!==0)return;const el=e.target.closest('button');if(!el)return;e.preventDefault();el.setPointerCapture(e.pointerId);beginGesture(el,el._control);});
$('screen-buttons').addEventListener('pointermove',e=>{if(!gesture||gesture.keyboard)return;const r=gesture.el.getBoundingClientRect(),margin=6;if(e.clientX<r.left-margin||e.clientX>r.right+margin||e.clientY<r.top-margin||e.clientY>r.bottom+margin)endGesture();});
document.addEventListener('pointerup',()=>{endGesture(true);releaseHardware();render();});document.addEventListener('pointercancel',()=>{endGesture();releaseHardware();});
$('screen-buttons').addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();beginGesture(e.target,e.target._control,true);}});
$('screen-buttons').addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();endGesture(true);render();}});
// Accessible activation is immediate for ordinary buttons; long-hold controls
// still require a held mouse, touch, Space or Enter gesture.
$('screen-buttons').addEventListener('click',e=>{if(e.detail===0&&!gesture){const c=e.target.closest('button')?._control;if(c&&!c.hold){c.action(0);beep();render();}}});
$('screen').addEventListener('pointerdown',e=>{if(machine.mode==='touch'){const r=$('screen').getBoundingClientRect();touchPoint={x:Math.round((e.clientX-r.left)/r.width*320),y:Math.round((e.clientY-r.top)/r.height*240)};render();}});
function rapidZero(now){if(!rapidHold||rapidHold.fired)return;if(machine.joy||machine.microDir||machine.target!==null){rapidHold.started=null;return;}if(rapidHold.started===null)rapidHold.started=now;if(now-rapidHold.started>=1000){rapidHold.fired=machine.zeroDRO();if(rapidHold.fired)beep();}}
function releaseHardware(){rapidZero(performance.now());rapidHold=null;machine.microDir=0;machine.rapidOn=false;if(microHeld){microHeld.classList.remove('pressed');microHeld=null;}}
function bindHold(id,start){const el=$(id);el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();el.setPointerCapture(e.pointerId);microHeld=el;el.classList.add('pressed');start();render();});el.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();microHeld=el;start();render();}});el.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();releaseHardware();render();}});el.addEventListener('lostpointercapture',()=>{releaseHardware();render();});}
bindHold('micro-left',()=>machine.microStart(-1));bindHold('micro-right',()=>machine.microStart(1));bindHold('rapid',()=>{machine.rapidOn=workMode(machine.mode)||machine.mode==='divider'||machine.mode==='hw';rapidHold={started:performance.now(),fired:false};if(!machine.joy)machine.event='Держите RAPID больше 1 секунды для обнуления. Электронные лимиты будут сняты.';});
document.querySelectorAll('[data-joy]').forEach(el=>el.addEventListener('click',()=>{machine.setJoy(Number(el.dataset.joy));beep();render();}));
$('spindle-toggle').addEventListener('click',()=>{machine.running=!machine.running;beep();render();});$('spindle-reverse').addEventListener('click',()=>{machine.spinSign*=-1;render();});
function rpm(value){machine.rpm=clamp(Number(value)||0,0,3000);$('rpm').value=machine.rpm;$('rpm-range').value=Math.min(1200,machine.rpm);render();}
$('rpm').addEventListener('input',e=>rpm(e.target.value));$('rpm-range').addEventListener('input',e=>rpm(e.target.value));
for(const[id,sign]of[['turn-back',-1],['turn-forward',1]])$(id).addEventListener('click',()=>{if(machine.running){machine.event='Остановите виртуальный шпиндель для поворота рукой.';}else machine.rotate(sign/24);render();});
$('zero').addEventListener('click',()=>{if(!machine.zeroDRO())machine.event='Для обнуления откройте рабочий режим и отпустите джойстик и микроподачу.';render();});
$('sound').addEventListener('change',e=>{sound=e.target.checked;beep();});
$('stop').addEventListener('click',()=>{machine.stop();endGesture();releaseHardware();render();});
$('reset').addEventListener('click',()=>{machine.stop();machine=new DemoMachine();endGesture();releaseHardware();try{localStorage.removeItem(STORAGE);}catch{}rpm(120);$('scenario').value='';touchPoint=null;render();});
$('scenario').addEventListener('change',e=>{
  const mode=e.target.value;if(!mode)return;machine.stop();machine.left=machine.right=null;machine.target=null;machine.z=machine.actualZ=machine.zero=0;machine.turns=0;machine.gap=0;machine.lastCommand=-1;
  machine.open(mode);
  if(mode==='thread'){machine.threadIndex=15;machine.event='Резьба 2,00 мм: включите джойстик и поворачивайте шпиндель кнопками 15°.';}
  if(mode==='step'){machine.distance=2.5;machine.afeed=60;machine.event='STEP 2,50 мм: включите джойстик, дождитесь DONE и верните его в нейтраль.';}
  if(mode==='divider'){machine.divisions=6;machine.event='Делилка: поворачивайте на 15°. Каждые 60° — отметка деления.';}
  if(mode==='cycle'){machine.left=-5;machine.right=5;machine.z=machine.actualZ=5;machine.feed=20;machine.rpm=300;machine.wait=1;rpm(300);machine.event='Цикл от −5 до +5 мм: включите джойстик влево и запустите шпиндель.';}
  e.target.value='';render();
});
window.addEventListener('blur',()=>{machine.stop();endGesture();releaseHardware();render();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){machine.stop();endGesture();releaseHardware();}});
let previous=performance.now(),lastRender=0;
function frame(now){const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;machine.tick(dt);
  rapidZero(now);
  if(gesture){const g=gesture,elapsed=now-g.started;
    if(g.control.hold){const p=Math.min(1,elapsed/g.control.hold);const bar=g.el.querySelector('.hold-progress');if(bar)bar.style.width=(p*90)+'%';if(p>=1&&!g.fired){g.fired=true;g.control.action();beep();render();}}
    else if(g.control.repeat&&elapsed>=450&&now-g.last>=120){g.last=now;g.repeats++;g.control.action(g.repeats);render();}
  }
  if(now-lastRender>=60){lastRender=now;render();}requestAnimationFrame(frame);
}
render();requestAnimationFrame(frame);
