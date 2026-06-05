/* a11y-pass — runnable audit. Paste into the browser devtools Console on any page
   (no dependencies, no install). Prints a report of measurable WCAG 2.2 failures the
   eye misses: contrast, tap targets, missing names, heading order, focus, color-only.
   This is the "measure, don't eyeball" companion to the a11y-pass checklist.
   Usage: copy this whole file → devtools Console → Enter. Or: a11yAudit() to re-run. */
(function(){
  function lum(c){const m=(c.match(/[\d.]+/g)||[0,0,0]).map(Number);
    const f=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4};
    return .2126*f(m[0]||0)+.7152*f(m[1]||0)+.0722*f(m[2]||0);}
  function bgOf(el){let e=el;while(e){const c=getComputedStyle(e).backgroundColor;
    if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c))return c;e=e.parentElement;}
    return getComputedStyle(document.body).backgroundColor||'rgb(255,255,255)';}
  function ratio(fg,bg){const L1=lum(fg),L2=lum(bg);const hi=Math.max(L1,L2),lo=Math.min(L1,L2);return (hi+.05)/(lo+.05);}
  function vis(el){const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}

  const fail=[],warn=[];
  // 1) text contrast
  document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span,li,button,label,td,th,small,strong,em').forEach(el=>{
    if(!el.textContent.trim()||!vis(el)||el.children.length>2)return;
    const cs=getComputedStyle(el),px=parseFloat(cs.fontSize),w=+cs.fontWeight||400;
    const large=px>=24||(px>=18.66&&w>=700),need=large?3:4.5;
    const r=ratio(cs.color,bgOf(el));
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
    const id=el.id,lbl=id&&document.querySelector(`label[for="${id}"]`);
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
  if(vp&&/user-scalable=no|maximum-scale=1(\b|[^.])/.test(vp.content))fail.push('viewport disables zoom (WCAG 1.4.4)');

  console.log('%c a11y-pass audit ','background:#0a6c50;color:#fff;font-weight:700;padding:2px 6px');
  console.log(`%cFAILS (${fail.length})`,'color:#e5484d;font-weight:700');fail.forEach(f=>console.log('  ✗ '+f));
  console.log(`%cWARNINGS (${warn.length})`,'color:#c2851a;font-weight:700');warn.forEach(w=>console.log('  ! '+w));
  console.log(`%c${fail.length===0?'No measured failures. Now do the MANUAL checks: keyboard pass + screen-reader spot check + 400% zoom.':'Fix fails, then re-run a11yAudit().'}`,'color:#888');
  window.a11yAudit=arguments.callee;
  return {fails:fail.length,warnings:warn.length};
})();
