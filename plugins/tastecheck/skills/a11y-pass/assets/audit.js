/* a11y-pass — runnable audit. Paste into the browser devtools Console on any page
   (no dependencies, no install). Prints a report of measurable WCAG 2.2 failures the
   eye misses: contrast, tap targets, missing names, heading order, focus, color-only.
   This is the "measure, don't eyeball" companion to the a11y-pass checklist.
   Usage: copy this whole file → devtools Console → Enter. Or: a11yAudit() to re-run. */
(function a11yAudit(){
  const colorCanvas=document.createElement('canvas');
  colorCanvas.width=colorCanvas.height=1;
  const colorCtx=colorCanvas.getContext('2d',{willReadFrequently:true});
  const cssEscape=window.CSS&&CSS.escape?CSS.escape:(s=>String(s).replace(/["\\]/g,'\\$&'));

  function rgba(c){
    if(!c||c==='transparent')return [0,0,0,0];
    if(window.CSS&&CSS.supports&&!CSS.supports('color',c))return null;
    colorCtx.clearRect(0,0,1,1);
    colorCtx.fillStyle='rgba(0,0,0,0)';
    colorCtx.fillStyle=c;
    colorCtx.fillRect(0,0,1,1);
    const d=colorCtx.getImageData(0,0,1,1).data;
    return [d[0],d[1],d[2],d[3]/255];
  }
  function over(top,bottom){
    const a=top[3]+bottom[3]*(1-top[3]);
    if(a===0)return [0,0,0,0];
    return [
      (top[0]*top[3]+bottom[0]*bottom[3]*(1-top[3]))/a,
      (top[1]*top[3]+bottom[1]*bottom[3]*(1-top[3]))/a,
      (top[2]*top[3]+bottom[2]*bottom[3]*(1-top[3]))/a,
      a
    ];
  }
  function lumRgb(rgb){
    const f=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};
    return .2126*f(rgb[0])+ .7152*f(rgb[1])+ .0722*f(rgb[2]);
  }
  function bgOf(el,warn){
    let bg=[255,255,255,1],stack=[],e=el;
    while(e){stack.unshift(e);e=e.parentElement;}
    stack.forEach(node=>{
      const cs=getComputedStyle(node);
      if(cs.backgroundImage&&cs.backgroundImage!=='none')warn.push(`BACKGROUND image/gradient behind text — manually verify contrast near "${(el.textContent||'').trim().slice(0,28)}"`);
      const c=rgba(cs.backgroundColor);
      if(c&&c[3]>0)bg=over(c,bg);
    });
    return bg;
  }
  function ratio(fg,bg){const L1=lumRgb(fg),L2=lumRgb(bg);const hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+.05)/(lo+.05);}
  function vis(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}

  const fail=[],warn=[];
  // 1) text contrast
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,button,label,td,th,small,strong,em').forEach(el=>{
    if(!el.textContent.trim()||!vis(el))return;
    const cs=getComputedStyle(el),px=parseFloat(cs.fontSize),w=+cs.fontWeight||400;
    const large=px>=24||(px>=18.66&&w>=700),need=large?3:4.5;
    const bg=bgOf(el,warn),fgRaw=rgba(cs.color);
    if(!fgRaw){warn.push(`COLOR parse failed — manually verify "${el.textContent.trim().slice(0,28)}"`);return;}
    const fg=fgRaw[3]<1?over(fgRaw,bg):fgRaw;
    const r=ratio(fg,bg);
    if(r<need-0.05)fail.push(`CONTRAST ${r.toFixed(2)}:1 (need ${need}) — ${px}px "${el.textContent.trim().slice(0,32)}"`);
    if(px<12)warn.push(`TINY ${px}px text — "${el.textContent.trim().slice(0,28)}"`);
  });
  // 2) tap targets (WCAG 2.5.8 ≥24px)
  document.querySelectorAll('a,button,input,select,summary,[role=button]').forEach(el=>{
    if(!vis(el))return;const r=el.getBoundingClientRect();
    if(r.height<24||r.width<24)fail.push(`TAP TARGET ${Math.round(r.width)}x${Math.round(r.height)} (<24) — ${el.tagName.toLowerCase()} "${(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,20)}"`);
  });
  // 3) accessible names
  document.querySelectorAll('img').forEach(el=>{if(el.getAttribute('alt')===null)fail.push(`IMG no alt — ${el.src.split('/').pop()}`);});
  document.querySelectorAll('input,select,textarea').forEach(el=>{
    const id=el.id,lbl=id&&document.querySelector(`label[for="${cssEscape(id)}"]`);
    if(!lbl&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby')&&el.type!=='hidden')
      fail.push(`INPUT no label — ${el.name||el.type}`);});
  document.querySelectorAll('button,a').forEach(el=>{if(vis(el)&&!el.textContent.trim()&&!el.getAttribute('aria-label')&&!el.querySelector('img[alt]'))fail.push(`${el.tagName} no accessible name`);});
  // 4) heading order
  const hs=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>+h.tagName[1]);
  if(hs.filter(h=>h===1).length!==1)warn.push(`H1 count = ${hs.filter(h=>h===1).length} (want exactly 1)`);
  for(let i=1;i<hs.length;i++)if(hs[i]-hs[i-1]>1){warn.push(`heading jump h${hs[i-1]}→h${hs[i]} (skipped a level)`);break;}
  // 5) focus visibility (heuristic): elements that remove outline without a focus-visible style
  let nofocus=0;document.querySelectorAll('a,button,input,select').forEach(el=>{const o=getComputedStyle(el).outlineStyle;if(o==='none')nofocus++;});
  if(nofocus>0)warn.push(`${nofocus} interactive els have outline:none at rest — verify a :focus-visible style exists`);
  // 6) landmarks
  if(!document.querySelector('main'))warn.push('no <main> landmark');
  // 7) viewport zoom lock
  const vp=document.querySelector('meta[name=viewport]');
  if(vp&&/user-scalable=no|maximum-scale=1(?:\.0+)?(?![.\d])/.test(vp.content))fail.push('viewport disables zoom (WCAG 1.4.4)');

  console.log('%c a11y-pass audit ','background:#0a6c50;color:#fff;font-weight:700;padding:2px 6px');
  console.log(`%cFAILS (${fail.length})`,'color:#e5484d;font-weight:700');fail.forEach(f=>console.log('  ✗ '+f));
  console.log(`%cWARNINGS (${warn.length})`,'color:#c2851a;font-weight:700');warn.forEach(w=>console.log('  ! '+w));
  console.log(`%c${fail.length===0?'No measured failures. Now do the MANUAL checks: keyboard pass + screen-reader spot check + 400% zoom.':'Fix fails, then re-run a11yAudit().'}`,'color:#888');
  window.a11yAudit=a11yAudit;
  return {fails:fail.length,warnings:warn.length};
})();
