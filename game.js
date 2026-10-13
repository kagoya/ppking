'use strict';
const $=id=>document.getElementById(id),canvas=$('court'),ctx=canvas.getContext('2d'),W=1000,H=500,PH=88;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const config={easy:{speed:215,error:65,ball:330},normal:{speed:310,error:37,ball:390},hard:{speed:405,error:18,ball:440}};
const skillNames=['バー延長','ボール追加','吸着'],skillIcons=['↕','●+','∪'],colors=['#d6f79a','#91d9ff','#ffb4df'];
let state='ready',py=250,cy=250,balls=[],scores=[0,0],rally=0,best=0,wait=0,direction=1,keys={},target=null,last=0,sound=false,audio=null,aiOffset=0;
let popups=[],popupClock=5+Math.random()*10,drops=[],effects=[{long:0,sticky:0},{long:0,sticky:0}];
function paddleHeight(side){return effects[side].long>0?154:PH}
function makeBall(x,y,vx,vy,owner=null){return {x,y,vx,vy,owner,held:null,holdTime:0,trail:[]}}
function beep(f=440){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.08)}catch{}}
function announce(text){$('status').textContent=text}
function hud(){ $('you').textContent=scores[0];$('cpu').textContent=scores[1];$('rally').textContent=rally;$('best').textContent=best;$('pause').disabled=state==='ready'||state==='over';$('difficulty').disabled=state==='playing'||state==='paused';$('pause').textContent=state==='paused'?'再開':'一時停止';
 for(let i=0;i<3;i++){const held=i===2&&balls.some(b=>b.held===0),btn=$('skill'+i);btn.disabled=state!=='playing'||!held;const content=`<b>${held?'3 · 発射！':skillNames[i]}</b><small>${held?'3キー / タップで発射':['受け取ると10秒間延長','受け取るとボールを2個追加','受け取ると吸着待機'][i]}</small>`;if(btn.innerHTML!==content)btn.innerHTML=content;}
 for(let side=0;side<2;side++){const e=effects[side],active=[];if(e.long>0)active.push(`延長 ${Math.ceil(e.long)}秒`);if(e.sticky>0)active.push(`吸着待機 ${Math.ceil(e.sticky)}秒`);if(balls.some(b=>b.held===side))active.push('吸着中');$('effects'+(side===0?'You':'Cpu')).textContent=`${side===0?'YOU':'CPU'} · ${active.join(' / ')||'技なし'}`;}}
function clearItems(){popups=[];popupClock=5+Math.random()*10;drops=[];effects=[{long:0,sticky:0},{long:0,sticky:0}]}
function serve(){balls=[makeBall(500,250,0,0)];rally=0;wait=1.1;aiOffset=(Math.random()-.5)*config[$('difficulty').value].error*2;hud()}

function start(){if(state==='paused'){state='playing';$('overlay').classList.add('hidden');hud();return}scores=[0,0];py=cy=250;clearItems();state='playing';direction=Math.random()<.5?-1:1;serve();$('overlay').classList.add('hidden');announce('試合中 · 最後の1球までラリー続行！');hud()}
function pause(){if(state==='playing'){state='paused';$('message').textContent='ひと休み。';$('sub').textContent='準備できたら、アイテムバトルを続けよう。';$('start').textContent='試合を再開 →';$('overlay').classList.remove('hidden');}else if(state==='paused')start();hud()}
function reset(){state='ready';scores=[0,0];py=cy=250;clearItems();balls=[makeBall(500,250,0,0)];rally=0;wait=0;target=null;keys={};$('message').textContent='王者を目指そう。';$('sub').textContent='左があなた。技を駆使して7点を目指そう。残りの球がある間はラリー続行！';$('start').textContent='ゲームをはじめる →';announce('的は5〜15秒に1個出現・最大5個・50〜100秒で消える · バーで取ると技が自動発動');$('overlay').classList.remove('hidden');hud()}
function point(who,missed){balls=balls.filter(b=>b!==missed);scores[who]++;beep(who===0?660:220);
 if(balls.length>0){announce(`${who===0?'あなた':'CPU'}に1点！残り${balls.length}球でラリー続行。`);hud();return;}
 if(Math.max(...scores)>=7&&scores[0]!==scores[1]){const winner=scores[0]>scores[1]?0:1;state='over';$('message').textContent=winner===0?'ピンポンキング！':'次こそ、王者に。';$('sub').textContent=`${scores[0]} − ${scores[1]} · ${winner===0?'ナイスゲーム！':'アイテムを使ってリベンジしよう。'}`;$('start').textContent='もう一度プレイ →';$('overlay').classList.remove('hidden');announce('試合終了');hud();}
 else{direction=who===0?-1:1;serve();announce(scores[0]===scores[1]&&scores[0]>=7?'同点！次のラリーで決着。':who===0?'あなたのポイント！次のサーブへ。':'CPUのポイント。次のサーブへ。');}}

function release(side){for(const b of balls){if(b.held!==side)continue;const speed=config[$('difficulty').value].ball*1.1;b.held=null;b.owner=side;b.vx=(side===0?1:-1)*speed;b.vy=-speed*.35;b.holdTime=0;}beep(600);hud()}
function activateSkill(side,type){if(state!=='playing')return false;
 if(type===0)effects[side].long=10;if(type===2)effects[side].sticky=10;
 if(type===1){const y=side===0?py:cy,speed=config[$('difficulty').value].ball;
 // Refresh extra balls if already at the cap, while preserving the main and held balls.
 const needed=Math.max(0,balls.length+2-5);let removed=0;
 balls=balls.filter((b,i)=>{if(i>0&&b.held===null&&removed<needed){removed++;return false}return true});
 for(const angle of [-.52,.52]){if(balls.length>=5)break;balls.push(makeBall(side===0?58:942,y,(side===0?1:-1)*speed*Math.cos(angle),speed*Math.sin(angle),side));}}
 announce(`${side===0?'あなた':'CPU'}が「${skillNames[type]}」を受け取り、自動発動！`);beep(760);hud();return true;}
function spawnPopup(){const room=5-popups.length-drops.length;if(room<=0)return;const count=1;
 for(let i=0;i<count;i++){let x,y;for(let attempt=0;attempt<30;attempt++){x=190+Math.random()*620;y=65+Math.random()*370;if(popups.every(p=>Math.hypot(p.x-x,p.y-y)>80))break;}popups.push({x,y,type:Math.floor(Math.random()*3),life:50+Math.random()*50});}
 beep(820);announce(`的が${count}個出現！当てた側へアイテムが横に降ってきます。`)}
function segmentDistance(ax,ay,bx,by,x,y){const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(ax+t*dx-x,ay+t*dy-y)}
function hitPopup(b,oldX,oldY){if(b.owner===null)return;
 popups=popups.filter(p=>{if(segmentDistance(oldX,oldY,b.x,b.y,p.x,p.y)>32)return true;const side=b.owner;
 drops.push({side,type:p.type,x:p.x,y:p.y,vx:side===0?-260:260});
 announce(`${side===0?'あなた':'CPU'}側へ「${skillNames[p.type]}」が降下中！`);beep(900);return false;});}
function updateItems(dt){for(const e of effects){e.long=Math.max(0,e.long-dt);e.sticky=Math.max(0,e.sticky-dt)}
 popups=popups.filter(p=>{p.life-=dt;return p.life>0});popupClock-=dt;if(popupClock<=0){popupClock=5+Math.random()*10;spawnPopup()}
 drops=drops.filter(d=>{const oldX=d.x;d.x+=d.vx*dt;const barX=d.side===0?35:965,barY=d.side===0?py:cy;
 const crosses=d.side===0?oldX>=barX&&d.x<=barX:oldX<=barX&&d.x>=barX;
 if(crosses&&Math.abs(d.y-barY)<=paddleHeight(d.side)/2+15){activateSkill(d.side,d.type);return false}
 if(d.x < -20 || d.x > 1020){announce(`${d.side===0?'あなた':'CPU'}がアイテムを取り逃しました。`);return false}return true;});}

function update(dt){if(state!=='playing')return;const conf=config[$('difficulty').value];updateItems(dt);if(keys.arrowup||keys.w)py-=560*dt;else if(keys.arrowdown||keys.s)py+=560*dt;else if(target!==null)py+=clamp(target-py,-850*dt,850*dt);py=clamp(py,paddleHeight(0)/2+9,H-paddleHeight(0)/2-9);
 const incoming=balls.filter(b=>b.held===null&&b.vx>0).sort((a,b)=>(951-a.x)/a.vx-(951-b.x)/b.vx)[0],drop=drops.find(d=>d.side===1),goal=incoming?incoming.y+aiOffset:drop?drop.y:250;cy=clamp(cy+clamp(goal-cy,-conf.speed*dt,conf.speed*dt),paddleHeight(1)/2+9,H-paddleHeight(1)/2-9);

 if(wait>0){wait-=dt;if(wait<=0){balls[0].vx=direction*conf.ball;balls[0].vy=(Math.random()<.5?-1:1)*conf.ball*.38;}hud();return;}
 for(const b of [...balls]){if(b.held!==null){const side=b.held;b.x=side===0?50:950;b.y=side===0?py:cy;b.holdTime+=dt;if(b.holdTime>=(side===0?3:1))release(side);continue;}
 b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>12)b.trail.pop();const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y<16){b.y=32-b.y;b.vy=Math.abs(b.vy);beep(320)}if(b.y>484){b.y=968-b.y;b.vy=-Math.abs(b.vy);beep(320)}let side=null;if(b.vx<0&&oldX>=49&&b.x<=49&&Math.abs(b.y-py)<paddleHeight(0)/2+8)side=0;if(b.vx>0&&oldX<=951&&b.x>=951&&Math.abs(b.y-cy)<paddleHeight(1)/2+8)side=1;
 if(side!==null){const y=side===0?py:cy,angle=clamp((b.y-y)/(paddleHeight(side)/2),-1,1)*1.04,speed=Math.min(850,Math.hypot(b.vx,b.vy)*1.055);b.x=side===0?49:951;b.owner=side;rally++;best=Math.max(best,rally);if(effects[side].sticky>0){effects[side].sticky=0;b.held=side;b.holdTime=0;b.vx=b.vy=0;b.y=y;announce(`${side===0?'あなた':'CPU'}がボールを吸着！${side===0?'3キーか発射ボタンで放そう（3秒で自動発射）。':''}`)}else{b.vx=(side===0?1:-1)*speed*Math.cos(angle);b.vy=speed*Math.sin(angle)}aiOffset=(Math.random()-.5)*conf.error*2;beep(520)}
 hitPopup(b,oldX,oldY);if(b.x<-20||b.x>1020){const lastBall=balls.length===1;point(b.x<-20?1:0,b);if(lastBall)return;continue;}}
 hud();}
function draw(){ctx.fillStyle='#213f35';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#69806a';ctx.lineWidth=2;ctx.strokeRect(14,10,972,480);ctx.beginPath();ctx.setLineDash([7,9]);ctx.moveTo(500,10);ctx.lineTo(500,490);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#58725d';ctx.beginPath();ctx.arc(500,250,60,0,Math.PI*2);ctx.stroke();
 for(const popup of popups){ctx.strokeStyle=colors[popup.type];ctx.lineWidth=3;ctx.beginPath();ctx.arc(popup.x,popup.y,24+Math.sin(popup.life*6)*3,0,Math.PI*2);ctx.stroke();ctx.fillStyle=colors[popup.type];ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.fillText(skillIcons[popup.type],popup.x,popup.y+7);ctx.font='12px system-ui';ctx.fillText(`${skillNames[popup.type]} · ${Math.ceil(popup.life)}秒`,popup.x,popup.y-36)}
 for(const d of drops){ctx.fillStyle=colors[d.type];ctx.fillRect(d.x-15,d.y-15,30,30);ctx.fillStyle='#172216';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText(skillIcons[d.type],d.x,d.y+6);ctx.strokeStyle=colors[d.type];ctx.beginPath();const dx=d.side===0?-1:1,dy=0;ctx.moveTo(d.x-dx*23,d.y-dy*23);ctx.lineTo(d.x-dx*43,d.y-dy*43);ctx.stroke();}
 for(let side=0;side<2;side++){const y=side===0?py:cy,h=paddleHeight(side);ctx.fillStyle=effects[side].sticky>0||balls.some(b=>b.held===side)?'#ffb4df':side===0?'#d6f79a':'#e8ede2';ctx.fillRect(side===0?29:959,y-h/2,12,h)}
 for(const b of balls){b.trail.forEach((p,i)=>{ctx.fillStyle=`rgba(231,255,182,${(1-i/12)*.18})`;ctx.beginPath();ctx.arc(p.x,p.y,8*(1-i/15),0,Math.PI*2);ctx.fill()});ctx.fillStyle=b.held!==null?'#ffb4df':'#f1ffce';ctx.beginPath();ctx.arc(b.x,b.y,8,0,Math.PI*2);ctx.fill();if(b.held!==null){ctx.fillStyle='#ffb4df';ctx.font='14px system-ui';ctx.textAlign=b.held===0?'left':'right';ctx.fillText('吸着中',b.held===0?65:935,b.y-18)}}
 if(wait>0&&state==='playing'){ctx.fillStyle='#e4f3ce';ctx.font='bold 36px system-ui';ctx.textAlign='center';ctx.fillText('READY',500,180)}}
function frame(t){const dt=Math.min((t-last)/1000,.04);last=t;for(let i=0;i<4;i++)update(dt/4);draw();requestAnimationFrame(frame)}
$('start').onclick=start;$('pause').onclick=pause;$('reset').onclick=reset;$('difficulty').onchange=reset;$('skill2').onclick=()=>{if(state==='playing'&&balls.some(b=>b.held===0))release(0)};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'音 ON':'音 OFF';$('sound').setAttribute('aria-pressed',String(sound));beep()};
window.addEventListener('keydown',e=>{const form=e.target.tagName==='SELECT'||e.target.tagName==='INPUT',button=e.target.tagName==='BUTTON';if(form||button&&e.key===' ')return;const key=e.key.toLowerCase();if(['arrowup','arrowdown',' ','w','s','3'].includes(key)){e.preventDefault();keys[key]=true;if(!e.repeat){if(key===' '){if(state==='ready'||state==='over')start();else pause()}if(key==='3'&&state==='playing'&&balls.some(b=>b.held===0))release(0)}}});window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);window.addEventListener('blur',()=>{keys={};if(state==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
function pointer(e){const r=canvas.getBoundingClientRect();target=clamp((e.clientY-r.top)/r.height*H,0,H)}canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)pointer(e)});canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointer(e)});canvas.addEventListener('pointerleave',()=>target=null);reset();requestAnimationFrame(frame);
