/* Storyteller voice.
   1) Recorded clips first: every line was recorded by a real storyteller voice (audio/clips.js maps text -> mp3).
      A line is split at " ... " into pieces; each piece plays its own clip, one after another.
   2) Any piece without a clip falls back to the device's built-in Thai voice, read slowly phrase by phrase. */
(function(){
  const ss=window.speechSynthesis;
  let voices=[],chosen=null,runId=0,keep=null;
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  const base=(document.currentScript&&document.currentScript.src||'').replace(/[^/]*$/,'');
  /* recorded clip map, loaded alongside this file */
  window.VOICE_CLIPS=window.VOICE_CLIPS||{};
  let clipsLoaded=false;const waiters=[];
  const kick=()=>{if(clipsLoaded)waiters.splice(0).forEach(f=>f())};
  try{const s=document.createElement('script');s.src=base+'audio/clips.js';s.onload=s.onerror=()=>{clipsLoaded=true;kick();setTimeout(prefetchAll,1500)};document.head.appendChild(s)}catch(e){clipsLoaded=true}
  /* wait (at most ms) until the list of recordings has loaded (it is small) */
  function whenReady(ms,f){if(clipsLoaded){f();return}let done=false;const g=()=>{if(done)return;done=true;f()};waiters.push(g);setTimeout(g,ms)}
  const keyOf=t=>t.replace(/[\s.,!?…]/g,'');
  const urlOf=id=>base+'audio/'+id+'.mp3';
  /* one shared player: phones unlock it on the first tap, then it can play every line */
  const player=new Audio();player.preload='auto';
  let unlocked=false;
  function unlock(){if(unlocked)return;unlocked=true;try{player.src=urlOf('v244');player.muted=true;const p=player.play();const back=()=>{try{player.pause()}catch(e){}player.muted=false};if(p&&p.then)p.then(back,back);else back()}catch(e){player.muted=false}}
  ['pointerdown','touchstart','click','keydown'].forEach(ev=>document.addEventListener(ev,unlock,{capture:true,passive:true}));
  /* quietly download every recording in the background so later lines start at once */
  const warm={};
  function prefetch(id){if(warm[id])return Promise.resolve();warm[id]=1;return fetch(urlOf(id)).then(r=>r.blob()).catch(()=>{})}
  async function prefetchAll(){const C=window.VOICE_CLIPS,src=keyOf([...document.scripts].map(x=>x.textContent).join(' '));const ids=[...new Set(Object.keys(C).filter(k=>src.includes(k)).map(k=>C[k]))];for(const id of ids){await prefetch(id)}}
  function score(v){let s=0;const n=v.name;
    if(/premium|enhanced|natural|neural|wavenet|studio/i.test(n))s+=6;
    if(/google/i.test(n))s+=3;
    if(!v.localService)s+=1;
    if(/kanya|premwadee|achara|narisa|female|woman|ผู้หญิง/i.test(n))s+=3;
    if(/niwat|pattara|male|ชาย/i.test(n))s-=8;
    return s}
  function load(){try{voices=ss.getVoices().filter(v=>/^th/i.test(v.lang)).sort((a,b)=>score(b)-score(a))}catch(e){voices=[]}
    const want=store.get('story-voice','');chosen=voices.find(v=>v.name===want)||voices[0]||null;
    window.dispatchEvent(new Event('storyvoices'))}
  try{load();if(ss)ss.onvoiceschanged=load}catch(e){}

  function phrases(t){
    const parts=t.replace(/\s+/g,' ').trim().split(' ');const out=[];let cur='';
    for(const p of parts){if((cur+p).length<10&&cur){cur+=' '+p}else{if(cur)out.push(cur);cur=p}}
    if(cur)out.push(cur);return out}
  function ttsOne(text,isLast,isQ,id,done){
    if(!ss||id!==runId){done();return}
    const u=new SpeechSynthesisUtterance(text);keep=u;
    if(chosen)u.voice=chosen;u.lang='th-TH';
    u.rate=0.78+Math.random()*0.04;u.pitch=isLast&&isQ?1.18:(1.0+Math.random()*0.08);u.volume=1;
    let fin=false;const f=()=>{if(fin)return;fin=true;done()};
    u.onend=f;u.onerror=f;
    try{ss.speak(u)}catch(e){f()}
    setTimeout(f,Math.max(1800,text.length*170));
  }
  function ttsPiece(text,id,done){
    const isQ=/[?]|ไหม|อะไร|ใคร|ยังไง|อย่างไร|เอ่ย|นะ$/.test(text);
    const ps=phrases(text.replace(/[?!]/g,''));let i=0;
    const next=()=>{if(id!==runId)return;if(i>=ps.length){done();return}
      const p=ps[i++],last=i===ps.length;ttsOne(p,last,isQ,id,()=>setTimeout(next,last?0:(/[ะาีูอ]$/.test(p)?260:180)))};
    next();
  }
  /* play one recorded line */
  function clipPiece(id,rid,done,fallback){
    let fin=false,tm=null;
    const f=()=>{if(fin)return;fin=true;clearTimeout(tm);player.onended=player.onerror=null;done()};
    const fb=()=>{if(fin)return;fin=true;clearTimeout(tm);player.onended=player.onerror=null;fallback()};
    if(rid!==runId){f();return}
    player.onended=f;player.onerror=fb;
    player.src=urlOf(id);
    const p=player.play();if(p&&p.catch)p.catch(fb);
    tm=setTimeout(f,15000);
    player.onloadedmetadata=()=>{clearTimeout(tm);tm=setTimeout(f,(player.duration||8)*1000+1500)};
  }
  function say(text,cb){
    const id=++runId;
    try{player.pause()}catch(e){}
    try{ss&&ss.cancel();ss&&ss.resume&&ss.resume()}catch(e){}
    const pieces=String(text).split(/\s*(?:\.{3}|…)\s*/).map(s=>s.trim()).filter(Boolean);
    let i=0,C=window.VOICE_CLIPS;window.Voice.onstart&&window.Voice.onstart();
    const next=()=>{
      if(id!==runId)return;
      if(i>=pieces.length){window.Voice.onend&&window.Voice.onend();cb&&cb();return}
      const p=pieces[i++];C=window.VOICE_CLIPS;const f=C[keyOf(p)];
      const go=()=>setTimeout(next,i<pieces.length?220:0);
      if(f)clipPiece(f,id,go,()=>ttsPiece(p,id,go));else{if(window.Voice.debug)console.log('[voice] no clip:',p);ttsPiece(p,id,go)}
    };
    whenReady(3000,()=>{if(id===runId)next()});
  }
  window.Voice={say,stop(){runId++;try{player.pause()}catch(e){}try{ss&&ss.cancel()}catch(e){}},
    list:()=>voices,current:()=>chosen,
    choose(name){chosen=voices.find(v=>v.name===name)||chosen;store.set('story-voice',chosen&&chosen.name)},
    supported:()=>true,hasClip:t=>!!window.VOICE_CLIPS[keyOf(t)],onstart:null,onend:null,debug:false};
})();
