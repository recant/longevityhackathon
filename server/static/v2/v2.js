function goTo(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='graphs')setTimeout(initGraphs,120);
  if(id==='dashboard')setTimeout(initRing,120);
}

let obN=0;
function goSlide(n){
  document.querySelectorAll('.ob-slide').forEach((s,i)=>{s.classList.remove('active','past');if(i<n)s.classList.add('past');else if(i===n)s.classList.add('active');});
  document.querySelectorAll('.ob-dot').forEach((d,i)=>d.classList.toggle('active',i===n));
  obN=n;
  document.getElementById('obBtn').textContent=n===3?'Start first test →':'Next';
}
function obNext(){if(obN<3)goSlide(obN+1);else goTo('dashboard');}

function openTasks(){document.getElementById('tasksOverlay').classList.add('open');document.getElementById('tasksSheet').classList.add('open');}
function closeTasks(){document.getElementById('tasksOverlay').classList.remove('open');document.getElementById('tasksSheet').classList.remove('open');}
function toggleTask(el){
  const c=el.querySelector('.task-check'),tx=el.querySelector('.task-text');
  const done=c.classList.toggle('done');
  tx.classList.toggle('done',done);
  c.innerHTML=done?'<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':'';
}

function showMilestone(){
  document.getElementById('msOverlay').classList.add('open');
  const a=document.getElementById('confArea');a.innerHTML='';
  ['#6B8F71','#C9A84C','#B07560','#5B7A8A'].forEach((c,ci)=>{
    for(let i=0;i<5;i++){
      const p=document.createElement('div');p.className='cp';
      p.style.cssText=`left:${(ci*25+Math.random()*20)}%;background:${c};animation-delay:${Math.random()*0.35}s;animation-duration:${0.6+Math.random()*0.3}s;transform:rotate(${Math.random()*360}deg)`;
      a.appendChild(p);
    }
  });
}
function closeMilestone(){document.getElementById('msOverlay').classList.remove('open');}

let ssInt=null,ssSec=30,ssR=0,selEff_=null;
function startSS(){
  document.getElementById('ssReady').classList.remove('show');
  document.getElementById('ssRunning').classList.add('show');
  ssSec=30;ssR=0;
  document.getElementById('ssTimerR').textContent='30';
  document.getElementById('ssRepsR').textContent='0';
  ssInt=setInterval(()=>{ssSec--;document.getElementById('ssTimerR').textContent=ssSec;if(ssSec<=0){clearInterval(ssInt);finishSS();}},1000);
}
function countRep(){ssR++;document.getElementById('ssRepsR').textContent=ssR;}
function undoRep(){if(ssR>0){ssR--;document.getElementById('ssRepsR').textContent=ssR;}}
function finishSS(){
  if(ssInt)clearInterval(ssInt);
  document.getElementById('ssRunning').classList.remove('show');
  document.getElementById('ssEffort').classList.add('show');
  document.getElementById('finalReps').textContent=ssR;
  selEff_=null;document.querySelectorAll('.eff-btn').forEach(b=>b.classList.remove('sel'));
}
function selEff(btn,v){selEff_=v;document.querySelectorAll('.eff-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');}
function showResult(){
  document.getElementById('ssEffort').classList.remove('show');
  document.getElementById('ssResult').classList.add('show');
  document.getElementById('resReps').textContent=ssR||11;
  document.getElementById('resEffort').textContent=selEff_||3;
}

function t(id,msg){const el=document.getElementById(id);el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2400);}

let ringOk=false,graphsOk=false;
function initRing(){
  if(ringOk)return;ringOk=true;
  new Chart(document.getElementById('ringChart'),{
    type:'doughnut',
    data:{datasets:[{data:[86,14],backgroundColor:['#6B8F71','#E8F0E9'],borderWidth:0}]},
    options:{cutout:'76%',responsive:false,plugins:{legend:{display:false},tooltip:{enabled:false}},animation:{duration:1000,easing:'easeOutQuart'}}
  });
}
function initGraphs(){
  if(graphsOk)return;graphsOk=true;
  new Chart(document.getElementById('vitalityChart'),{
    type:'line',
    data:{labels:['Nov','Dec','Jan','Feb','Mar','Apr'],datasets:[{label:'Vitality',data:[65,67,63,69,81,74],borderColor:'#6B8F71',backgroundColor:'rgba(107,143,113,0.09)',borderWidth:2.5,pointBackgroundColor:'#6B8F71',pointRadius:5,pointHoverRadius:7,tension:0.4,fill:true}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' Score: '+c.parsed.y}}},scales:{y:{min:50,max:90,ticks:{font:{size:10},color:'#7A8C82'},grid:{color:'rgba(0,0,0,0.04)'}},x:{ticks:{font:{size:11},color:'#7A8C82'},grid:{display:false}}}}
  });
  const f=document.getElementById('bioFill');
  if(f){f.style.width='0%';setTimeout(()=>f.style.width='62%',300);}
}

setTimeout(initRing,400);