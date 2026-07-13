/* tastecheck-pass — gate audit. Paste into the browser devtools Console on a FRESH,
   untouched load of the finished page (no clicks, no scrolling, no toggles first).
   It checks the claims that self-reported gate tables most often get wrong: cold-load
   state honesty (errors showing before input, hidden defeated by CSS, unrevealed
   content) and the countable structural/surface tells (uniform card grids, stat
   bands, pill CTAs, default display faces, the indigo gradient). Companion to the
   a11y-pass audit.js — run both.
   Usage: copy this whole file → devtools Console → Enter. Or: gateAudit() to re-run.
   Paste the printed lines into the TASTECHECK PASS report Notes — script output is
   the evidence; a checkmark without it is a claim. */
(function gateAudit(){
  const fails=[], warns=[], notes=[];
  const cs=el=>getComputedStyle(el);
  const visible=el=>{
    const s=cs(el);
    if(s.display==='none'||s.visibility==='hidden')return false;
    const r=el.getBoundingClientRect();
    return r.width>0&&r.height>0;
  };
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const name=el=>{
    let n=el.tagName.toLowerCase()
      +(el.id?'#'+el.id:'')
      +(el.classList.length?'.'+el.classList[0]:'');
    if(!el.id&&!el.classList.length&&el.parentElement){
      /* anonymous element — add position + parent so the locator stays usable */
      const sibs=[...el.parentElement.children].filter(s=>s.tagName===el.tagName);
      if(sibs.length>1)n+=`:nth-of-type(${sibs.indexOf(el)+1})`;
      const p=el.parentElement;
      n=p.tagName.toLowerCase()+(p.id?'#'+p.id:'')
        +(p.classList.length?'.'+p.classList[0]:'')+' > '+n;
    }
    return n;
  };
  const px=v=>parseFloat(v)||0;
  const bodyFont=px(cs(document.body).fontSize)||16;

  /* 1. FAIL — [hidden] defeated by author CSS (a display rule beats the attribute) */
  const hiddenHits=[];
  document.querySelectorAll('[hidden]').forEach(el=>{
    if(cs(el).display!=='none'){
      hiddenHits.push(el);
      const t=text(el);
      fails.push(`[hidden] rendered visible (CSS display:${cs(el).display} beats the attribute): ${name(el)}${t?` — "${t.slice(0,40)}"`:''}`);
    }
  });

  /* 2. FAIL — error/alert content visible before any user input. One defect, one
        line: anything check 1 already reported (or its wrapper) is skipped here */
  const errCands=[...document.querySelectorAll('[role="alert"],[aria-invalid="true"],[class*="error" i]')];
  errCands.forEach(el=>{
    if(errCands.some(o=>o!==el&&o.contains(el)))return; /* outermost only */
    if(hiddenHits.some(h=>h===el||h.contains(el)||el.contains(h)))return;
    if(el.matches('[aria-invalid="true"]')&&el.matches('input,select,textarea')){
      fails.push(`field marked aria-invalid on a fresh load: ${name(el)}`);
      return;
    }
    const t=text(el);
    if(t&&visible(el))
      fails.push(`error text visible before any input: "${t.slice(0,60)}" (${name(el)})`);
  });

  /* 3. FAIL — stuck busy state on a fresh load */
  document.querySelectorAll('[aria-busy="true"]').forEach(el=>{
    if(visible(el))fails.push(`aria-busy="true" on a fresh load: ${name(el)}`);
  });

  /* 4. WARN — unrevealed content: real text sitting at computed opacity 0
        (the scroll-reveal trap: stylesheet hides it, JS never showed it) */
  const ghost=[...document.querySelectorAll('body *')].filter(el=>
    cs(el).opacity==='0'&&cs(el).display!=='none'
    &&!el.closest('[hidden],[aria-hidden="true"]')&&text(el).length>60);
  const ghostTop=ghost.filter(el=>!ghost.some(o=>o!==el&&o.contains(el)));
  ghostTop.slice(0,5).forEach(el=>
    warns.push(`content at opacity 0 on load (unrevealed?): ${name(el)} — "${text(el).slice(0,50)}…"`));
  if(ghostTop.length>5)warns.push(`…and ${ghostTop.length-5} more opacity-0 blocks`);

  /* 5. WARN — skeleton placeholders visible on a fresh load */
  const skel=[...document.querySelectorAll('[class*="skeleton" i]')].filter(visible);
  if(skel.length)warns.push(`${skel.length} skeleton placeholder(s) visible on load (stuck loading state?)`);

  /* 6. WARN — the uniform card grid (N identical bordered/rounded siblings) */
  const seen=new Set();
  document.querySelectorAll('body *').forEach(parent=>{
    const kids=[...parent.children].filter(visible);
    if(kids.length<3)return;
    const sig=el=>el.tagName+'|'+[...el.classList].sort().join('.');
    const groups={};
    kids.forEach(k=>{(groups[sig(k)]=groups[sig(k)]||[]).push(k);});
    Object.values(groups).forEach(g=>{
      if(g.length<3)return;
      const r0=g[0].getBoundingClientRect();
      if(r0.width*r0.height<12000)return;
      const same=g.every(k=>{
        const r=k.getBoundingClientRect();
        return Math.abs(r.width-r0.width)<9&&Math.abs(r.height-r0.height)<9;
      });
      const s0=cs(g[0]);
      const cardish=px(s0.borderRadius)>=4||s0.boxShadow!=='none'
        ||(px(s0.borderTopWidth)>0&&px(s0.borderBottomWidth)>0
           &&px(s0.borderLeftWidth)>0&&px(s0.borderRightWidth)>0);
      const key=name(parent)+sig(g[0]);
      if(same&&cardish&&!seen.has(key)){
        seen.add(key);
        warns.push(`uniform card grid: ${g.length}× identical ${name(g[0])} in ${name(parent)} (equal size, bordered/rounded — the "three cards" tell?)`);
      }
    });
  });

  /* 7. WARN — the stat-counter band (3+ big numeric callouts in one container).
        Not stats: ordered lists, 01/02/03 ordinals (enumerations), and bare prices
        ($29 = pricing tier; currency only counts with a magnitude suffix, $2M) */
  document.querySelectorAll('body *').forEach(parent=>{
    if(parent.tagName==='OL')return;
    const kids=[...parent.children].filter(visible);
    if(kids.length<3)return;
    const stat=kids.filter(k=>{
      /* the biggest-font short text inside the block is the candidate numeral */
      const lead=[k,...k.querySelectorAll('*')]
        .filter(e=>{const t=text(e);return t&&t.length<=8;})
        .sort((a,b)=>px(cs(b).fontSize)-px(cs(a).fontSize))[0];
      if(!lead||px(cs(lead).fontSize)<bodyFont*1.6)return false;
      /* a numeral in a date context (event lists, calendars) is not a stat */
      if(lead.closest('time,[class*="date" i],[class*="day" i],[class*="month" i]'))return false;
      const t=text(lead).trim();
      if(/^[$€£]/.test(t))return /^[$€£]\d[\d.,]*\s?(k|K|M)\+?$/.test(t);
      return /^~?(?!0\d)\d[\d.,]*\s?(%|\+|k|K|M|x|×)?\+?$/.test(t);
    });
    if(stat.length>=3&&!seen.has('stat'+name(parent))){
      seen.add('stat'+name(parent));
      warns.push(`stat-counter band: ${stat.length} numeric callouts in ${name(parent)} (the SaaS social-proof tell?)`);
    }
  });

  /* 8. NOTE/WARN — computed display face (catches what source greps miss) */
  const h=document.querySelector('h1')||document.querySelector('h2');
  if(h){
    const face=cs(h).fontFamily.split(',')[0].replace(/["']/g,'').trim();
    if(/^(inter|roboto|arial|helvetica( neue)?|open sans|system-ui|-apple-system|segoe ui|ui-sans-serif)$/i.test(face))
      warns.push(`display face resolves to "${face}" — the safe-font tell (computed, after font fallback)`);
    else notes.push(`display face resolves to "${face}"`);
  }

  /* 9. WARN — pill text CTA (computed radius ≥ half the height on a text button) */
  document.querySelectorAll('a,button,[role="button"],input[type="submit"]').forEach(el=>{
    if(!visible(el))return;
    const t=text(el)||el.value||'';
    const r=el.getBoundingClientRect();
    if(t.length>=8&&r.height>=30&&px(cs(el).borderRadius)>=r.height/2)
      warns.push(`pill text CTA: "${t.slice(0,30)}" (${name(el)}, radius ${cs(el).borderRadius} on ${Math.round(r.height)}px)`);
  });

  /* 10. WARN — the indigo→violet gradient (computed, any element) */
  for(const el of document.querySelectorAll('body, body *')){
    const bg=cs(el).backgroundImage;
    if(bg.includes('gradient')&&(/99[,\s]+102[,\s]+241|129[,\s]+140[,\s]+248|#6366f1|#818cf8/.test(bg))&&(/168[,\s]+85[,\s]+247|192[,\s]+132[,\s]+252|#a855f7|#c084fc/.test(bg))){
      warns.push(`indigo→violet gradient on ${name(el)} — the canonical AI tell`);
      break;
    }
  }

  /* report */
  const verdict=fails.length?'FAIL':warns.length?'REVIEW WARNS':'CLEAN';
  const wShow=warns.length>12?[...warns.slice(0,12),`…and ${warns.length-12} more warns`]:warns;
  const lines=[
    'TASTECHECK GATE AUDIT — fresh-load + tells (paste into the gate report)',
    ...fails.map(f=>'✗ FAIL '+f),
    ...wShow.map(w=>'⚠ WARN '+w),
    ...notes.map(n=>'— '+n),
    `verdict: ${verdict} — ${fails.length} fail / ${warns.length} warn · 10 checks · gateAudit() to re-run`,
    'Scope: light DOM only — shadow roots and iframes are not audited.',
    'Reminder: run on a FRESH load. Warns are evidence for judgment against the committed spec, not verdicts.'
  ];
  console.log(lines.join('\n'));
  window.gateAudit=gateAudit;
  /* Automation surface: a browser-driving harness (Playwright/Puppeteer/CDP) that
     injects this file reads the structured result here instead of scraping the
     console — addScriptTag runs the IIFE synchronously, so __gateAudit is set by
     the time the inject call resolves. warns is the FULL list, not the console cap. */
  window.__gateAudit={verdict,fails,warns,notes};
  return window.__gateAudit;
})();
