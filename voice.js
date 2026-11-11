/* Storyteller voice: speaks Thai like someone reading a picture book —
   phrase by phrase, slower, small pauses, gentle rise on questions.
   Uses the device's built-in Thai voice (prefers enhanced / natural ones). */
(function(){
  const ss=window.speechSynthesis;
  let voices=[],chosen=null,queue=[],playing=false,runId=0,keep=null;
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
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

  /* split into short phrases at spaces; keep very short bits together */
  function phrases(t){
    const parts=t.replace(/\s+/g,' ').trim().split(' ');const out=[];let cur='';
    for(const p of parts){if((cur+p).length<10&&cur){cur+=' '+p}else{if(cur)out.push(cur);cur=p}}
    if(cur)out.push(cur);return out}
  function speakOne(text,isLast,isQ,id,done){
    if(!ss||id!==runId){done();return}
    const u=new SpeechSynthesisUtterance(text);keep=u;
    if(chosen)u.voice=chosen;u.lang='th-TH';
    u.rate=0.78+Math.random()*0.04;               // calm, unhurried
    u.pitch=isLast&&isQ?1.18:(1.0+Math.random()*0.08); // questions lift at the end
    u.volume=1;
    let fin=false;const f=()=>{if(fin)return;fin=true;done()};
    u.onend=f;u.onerror=f;
    try{ss.speak(u)}catch(e){f()}
    setTimeout(f,Math.max(1800,text.length*170));   // safety if the engine never reports back
  }
  function say(text,cb,opts){
    opts=opts||{};const id=++runId;
    try{ss&&ss.cancel();ss&&ss.resume&&ss.resume()}catch(e){}
    const isQ=/[?]|ไหม|อะไร|ใคร|ยังไง|อย่างไร|เอ่ย|นะ$/.test(text);
    const ps=phrases(text.replace(/\.{2,}|…/g,' ').replace(/[?!]/g,''));
    let i=0;window.Voice.onstart&&window.Voice.onstart();
    const next=()=>{
      if(id!==runId)return;
      if(i>=ps.length){window.Voice.onend&&window.Voice.onend();cb&&cb();return}
      const p=ps[i++],last=i===ps.length;
      speakOne(p,last,isQ,id,()=>setTimeout(next,last?0:(/[ะาีูอ]$/.test(p)?260:180)));
    };
    next();
  }
  window.Voice={say,stop(){runId++;try{ss&&ss.cancel()}catch(e){}},
    list:()=>voices,current:()=>chosen,
    choose(name){chosen=voices.find(v=>v.name===name)||chosen;store.set('story-voice',chosen&&chosen.name)},
    supported:()=>!!ss,onstart:null,onend:null};
})();
