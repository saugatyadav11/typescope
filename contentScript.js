// TypeScope content script — scans the page and returns a summary to popup.
// Popup is the only UI container. This script draws on-page badges + tooltip.

(() => {
  if (window.__typoscopeLoaded) return;
  window.__typoscopeLoaded = true;

  const STATE = {
    groups: [],
    groupsInitialSnapshot: [],
    totalElements: 0,
    styleEl: null,
    badgeLayer: null,
    tooltipEl: null,
    rafPending: false,
    lastScanHash: null,

    // Tunables
    sizeStep: 0.25,          // quantization
    mergeTolerance: 0.5,     // merge sizes closer than this
    nearSizeTolerance: 0.4,  // auto-suppress “too close” sizes
  };

  // Tailwind hues used for color picking (oklch values from @theme reference)
  const TAILWIND = {
    red:     {50:'oklch(0.971 0.013 17.38)',100:'oklch(0.936 0.032 17.717)',200:'oklch(0.885 0.062 18.334)',500:'oklch(0.637 0.237 25.331)',600:'oklch(0.577 0.245 27.325)',800:'oklch(0.444 0.177 26.899)'},
    orange:  {50:'oklch(0.98 0.016 73.684)',100:'oklch(0.954 0.038 75.164)',200:'oklch(0.901 0.076 70.697)',500:'oklch(0.705 0.213 47.604)',600:'oklch(0.646 0.222 41.116)',800:'oklch(0.47 0.157 37.304)'},
    amber:   {50:'oklch(0.987 0.022 95.277)',100:'oklch(0.962 0.059 95.617)',200:'oklch(0.924 0.12 95.746)',500:'oklch(0.769 0.188 70.08)',600:'oklch(0.666 0.179 58.318)',800:'oklch(0.473 0.137 46.201)'},
    yellow:  {50:'oklch(0.987 0.026 102.212)',100:'oklch(0.973 0.071 103.193)',200:'oklch(0.945 0.129 101.54)',500:'oklch(0.795 0.184 86.047)',600:'oklch(0.681 0.162 75.834)',800:'oklch(0.476 0.114 61.907)'},
    lime:    {50:'oklch(0.986 0.031 120.757)',100:'oklch(0.967 0.067 122.328)',200:'oklch(0.938 0.127 124.321)',500:'oklch(0.768 0.233 130.85)',600:'oklch(0.648 0.2 131.684)',800:'oklch(0.453 0.124 130.933)'},
    green:   {50:'oklch(0.982 0.018 155.826)',100:'oklch(0.962 0.044 156.743)',200:'oklch(0.925 0.084 155.995)',500:'oklch(0.723 0.219 149.579)',600:'oklch(0.627 0.194 149.214)',800:'oklch(0.448 0.119 151.328)'},
    emerald: {50:'oklch(0.979 0.021 166.113)',100:'oklch(0.95 0.052 163.051)',200:'oklch(0.905 0.093 164.15)',500:'oklch(0.696 0.17 162.48)',600:'oklch(0.596 0.145 163.225)',800:'oklch(0.432 0.095 166.913)'},
    teal:    {50:'oklch(0.984 0.014 180.72)',100:'oklch(0.953 0.051 180.801)',200:'oklch(0.91 0.096 180.426)',500:'oklch(0.704 0.14 182.503)',600:'oklch(0.6 0.118 184.704)',800:'oklch(0.437 0.078 188.216)'},
    cyan:    {50:'oklch(0.984 0.019 200.873)',100:'oklch(0.956 0.045 203.388)',200:'oklch(0.917 0.08 205.041)',500:'oklch(0.715 0.143 215.221)',600:'oklch(0.609 0.126 221.723)',800:'oklch(0.45 0.085 224.283)'},
    sky:     {50:'oklch(0.977 0.013 236.62)',100:'oklch(0.951 0.026 236.824)',200:'oklch(0.901 0.058 230.902)',500:'oklch(0.685 0.169 237.323)',600:'oklch(0.588 0.158 241.966)',800:'oklch(0.443 0.11 240.79)'},
    blue:    {50:'oklch(0.97 0.014 254.604)',100:'oklch(0.932 0.032 255.585)',200:'oklch(0.882 0.059 254.128)',500:'oklch(0.623 0.214 259.815)',600:'oklch(0.546 0.245 262.881)',800:'oklch(0.424 0.199 265.638)'},
    indigo:  {50:'oklch(0.962 0.018 272.314)',100:'oklch(0.93 0.034 272.788)',200:'oklch(0.87 0.065 274.039)',500:'oklch(0.585 0.233 277.117)',600:'oklch(0.511 0.262 276.966)',800:'oklch(0.398 0.195 277.366)'},
    violet:  {50:'oklch(0.969 0.016 293.756)',100:'oklch(0.943 0.029 294.588)',200:'oklch(0.894 0.057 293.283)',500:'oklch(0.606 0.25 292.717)',600:'oklch(0.541 0.281 293.009)',800:'oklch(0.432 0.232 292.759)'},
    purple:  {50:'oklch(0.977 0.014 308.299)',100:'oklch(0.946 0.033 307.174)',200:'oklch(0.902 0.063 306.703)',500:'oklch(0.627 0.265 303.9)',600:'oklch(0.558 0.288 302.321)',800:'oklch(0.438 0.218 303.724)'},
    fuchsia: {50:'oklch(0.977 0.017 320.058)',100:'oklch(0.952 0.037 318.852)',200:'oklch(0.903 0.076 319.62)',500:'oklch(0.667 0.295 322.15)',600:'oklch(0.591 0.293 322.896)',800:'oklch(0.452 0.211 324.591)'},
    pink:    {50:'oklch(0.971 0.014 343.198)',100:'oklch(0.948 0.028 342.258)',200:'oklch(0.899 0.061 343.231)',500:'oklch(0.656 0.241 354.308)',600:'oklch(0.592 0.249 0.584)',800:'oklch(0.459 0.187 3.815)'},
    rose:    {50:'oklch(0.969 0.015 12.422)',100:'oklch(0.941 0.03 12.58)',200:'oklch(0.892 0.058 10.001)',500:'oklch(0.645 0.246 16.439)',600:'oklch(0.586 0.253 17.585)',800:'oklch(0.455 0.188 13.697)'},
    slate:   {50:'oklch(0.984 0.003 247.858)',100:'oklch(0.968 0.007 247.896)',200:'oklch(0.929 0.013 255.508)',500:'oklch(0.554 0.046 257.417)',600:'oklch(0.446 0.043 257.281)',800:'oklch(0.279 0.041 260.031)'},
    gray:    {50:'oklch(0.985 0.002 247.839)',100:'oklch(0.967 0.003 264.542)',200:'oklch(0.928 0.006 264.531)',500:'oklch(0.551 0.027 264.364)',600:'oklch(0.446 0.03 256.802)',800:'oklch(0.278 0.033 256.848)'},
    zinc:    {50:'oklch(0.985 0 0)',100:'oklch(0.967 0.001 286.375)',200:'oklch(0.92 0.004 286.32)',500:'oklch(0.552 0.016 285.938)',600:'oklch(0.442 0.017 285.786)',800:'oklch(0.274 0.006 286.033)'},
    neutral: {50:'oklch(0.985 0 0)',100:'oklch(0.97 0 0)',200:'oklch(0.922 0 0)',500:'oklch(0.556 0 0)',600:'oklch(0.439 0 0)',800:'oklch(0.269 0 0)'},
    stone:   {50:'oklch(0.985 0.001 106.423)',100:'oklch(0.97 0.001 106.424)',200:'oklch(0.923 0.003 48.717)',500:'oklch(0.553 0.013 58.071)',600:'oklch(0.444 0.011 73.639)',800:'oklch(0.268 0.007 34.298)'},
  };
  const HUES = Object.keys(TAILWIND);
  const DISTINCT = ['blue','rose','emerald','amber','violet','cyan','fuchsia','lime'];

  /* ---------------- utils ---------------- */
  function weightName(n){const v=parseInt(n,10);if(isNaN(v))return String(n);
    if(v<=150)return'Thin'; if(v<=250)return'ExtraLight'; if(v<=350)return'Light'; if(v<=450)return'Regular'; if(v<=550)return'Medium';
    if(v<=650)return'SemiBold'; if(v<=750)return'Bold'; if(v<=850)return'ExtraBold'; return'Black';}
  function normalizeFamily(f){if(!f)return'';return f.split(',')[0].trim().replace(/^["']|["']$/g,'');}
  function visible(el){if(!(el instanceof Element))return false;const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0)return false;
    const r=el.getBoundingClientRect(); return r.width>0&&r.height>0;}
  function parsePxFloat(v,f=0){if(!v)return f; if(v==='normal')return f; const n=parseFloat(v); return isNaN(n)?f:n;}
  function quantizeSize(px,step){return Math.round(px/step)*step;}
  function fmtPx(n){const x=Number(n);return Math.abs(x-Math.round(x))<0.01?`${Math.round(x)}px`:`${Number(x.toFixed(2))}px`;}
  function deriveLine(cs,fs){const lh=cs.lineHeight; if(!lh||lh==='normal') return fs*1.2; if(lh.endsWith('px')) return parsePxFloat(lh,fs*1.2);
    const u=parseFloat(lh); return isNaN(u)?fs*1.2:fs*u;}
  function numberRange(vals){const arr=[...vals]; if(!arr.length) return null; const min=Math.min(...arr),max=Math.max(...arr),single=Math.abs(min-max)<0.01; return{min,max,single};}
  function weightRangeLabel(vals){const r=numberRange(vals); if(!r) return ''; const a=Math.round(r.min),b=Math.round(r.max); return r.single?`${weightName(a)}`:`${weightName(a)}, ${weightName(b)}`;}
  function pxRangeLabel(vals){const r=numberRange(vals); if(!r) return ''; return r.single?fmtPx(r.min):`${Math.round(r.min)} to ${Math.round(r.max)}px`; }

  function getAllTextElements(limit=8000, root=document.body){
    const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode(n){
      if(!n||!n.nodeValue||!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const el=n.parentElement; if(!el) return NodeFilter.FILTER_REJECT;
      const t=el.tagName; if(['SCRIPT','STYLE','NOSCRIPT','IFRAME','CANVAS','SVG','IMG','VIDEO','AUDIO','PICTURE'].includes(t)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;}});
    const set=new Set();
    while(set.size<limit){const node=walker.nextNode(); if(!node) break; const el=node.parentElement; if(el&&visible(el)) set.add(el);}
    return [...set];
  }

  function hashDomSample(){
    try{
      const els=getAllTextElements(200);
      const sig=els.slice(0,200).map(el=>{const cs=getComputedStyle(el);return `${cs.fontSize}|${cs.lineHeight}|${cs.fontWeight}|${cs.letterSpacing}`;}).join(';');
      let h=0; for(let i=0;i<sig.length;i++) h=(h*31+sig.charCodeAt(i))&0xffffffff; return String(h);
    }catch{return String(Date.now());}
  }

  function mergeCloseSizes(groups, tolPx){
    if(groups.length<=1) return groups;
    const merged=[]; let cur=groups[0];
    for(let i=1;i<groups.length;i++){
      const g=groups[i];
      if(Math.abs(g.sizePx-cur.sizePx) <= tolPx){
        const prev=cur.elements.length;
        cur.elements.push(...g.elements);
        cur.sizePx=(cur.sizePx*prev + g.sizePx*g.elements.length)/cur.elements.length;
        g.weights.forEach(v=>cur.weights.add(v));
        g.lineHeights.forEach(v=>cur.lineHeights.add(v));
        g.letterSpacings.forEach(v=>cur.letterSpacings.add(v));
        g.familiesCount.forEach((c,f)=>cur.familiesCount.set(f,(cur.familiesCount.get(f)||0)+c));
      } else { merged.push(cur); cur=g; }
    }
    merged.push(cur); return merged;
  }

  function suppressNearSizes(groups, tol){
    let last=null;
    groups.forEach(g=>{
      if(last===null){ g.active=true; g.autoSuppressed=false; g.anchorSizePx=null; last=g.sizePx; }
      else if(Math.abs(g.sizePx-last) < tol){ g.active=false; g.autoSuppressed=true; g.anchorSizePx=last; }
      else { g.active=true; g.autoSuppressed=false; g.anchorSizePx=null; last=g.sizePx; }
    });
  }

  function computeHueMapForActive(groups){
    const actives=groups.filter(g=>g.active);
    const sorted=[...actives].sort((a,b)=>b.elements.length-a.elements.length);
    const distinct=DISTINCT.filter(h=>h in TAILWIND);
    const rest=HUES.filter(h=>!distinct.includes(h));
    const palette=[...distinct, ...rest];
    const map=new Map();
    sorted.forEach((g,i)=>map.set(g.sizePx, palette[i%palette.length]||'slate'));
    return map;
  }

  /* ---------------- styles (hover outline / tooltip / badges) ---------------- */
  function ensureStyleEl(){
    if(STATE.styleEl && STATE.styleEl.isConnected) return STATE.styleEl;
    const el=document.createElement('style'); el.id='typoscope-style'; document.documentElement.appendChild(el); STATE.styleEl=el; return el;
  }
  function applyStyles(){
    const styleEl=ensureStyleEl();
    const parts=[];
    STATE.groups.forEach((g,idx)=>{
      const c600=TAILWIND[g.hue||'neutral'][600] || '#000';
      const fg = TAILWIND[g.hue||'neutral'][50] || '#fff';
      parts.push(`
        [data-typoscope][data-typo-group="${idx}"][data-typo-active="true"]:hover{
          outline:2px dotted ${c600}!important; outline-offset:2px!important;
        }
        .typoscope-badge[data-group="${idx}"]{
          background:${c600}!important;
          color:${fg}!important;
        }
      `);
    });
    parts.push(`
      #typoscope-tooltip{
        position:fixed;top:0;left:0;transform:translate(-9999px,-9999px);z-index:2147483647;pointer-events:none;
        font:12px/1.35 Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        background:rgba(15,15,26,0.64); /* #0F0F1A with 64% opacity */
        color:#fff; border:1px solid rgba(255, 255, 255, 0.12);
        padding:12px 12px; border-radius:12px; white-space:nowrap; box-shadow:0 6px 16px rgba(0,0,0,.2);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      #typoscope-tooltip .row{display:flex;gap:16px;margin-bottom:10px;}
      #typoscope-tooltip .row:last-child{margin-bottom:0;}
      #typoscope-tooltip .label{color:#fff;min-width:86px;}
      #typoscope-tooltip .val{color:#fff;font-weight:500;}
      #typoscope-badge-layer{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483646;}
      .typoscope-badge{position:absolute;min-width:22px;height:22px;padding:0 4px;border-radius:8px;font:11px/22px Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;text-align:center;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,.25);}
    `);
    styleEl.textContent = parts.join('\n');
  }

  /* badges */
  function ensureBadgeLayer(){ if(STATE.badgeLayer&&STATE.badgeLayer.isConnected) return STATE.badgeLayer;
    const d=document.createElement('div'); d.id='typoscope-badge-layer'; document.body.appendChild(d); STATE.badgeLayer=d; return d;}
  function buildBadges(){
    const layer=ensureBadgeLayer(); layer.innerHTML='';
    STATE.groups.forEach((g,idx)=>{
      const bg = TAILWIND[g.hue||'neutral'][600] || '#000';
      const fg = TAILWIND[g.hue||'neutral'][50] || '#fff';
      g.badges=[];
      g.elements.forEach(el=>{
        const b=document.createElement('div'); b.className='typoscope-badge'; b.dataset.group=String(idx);
        b.style.background=bg;
        b.style.color=fg;
        b.textContent=String(Math.round(g.sizePx)); b.style.display=g.active?'block':'none';
        layer.appendChild(b); g.badges.push({el,node:b});
      });
    });
    scheduleBadgePositioning();
  }
  function updateBadgeColorsForGroup(i){
    const g=STATE.groups[i];
    if(!g||!g.badges) return;
    const bg = TAILWIND[g.hue||'neutral'][600] || '#000';
    const fg = TAILWIND[g.hue||'neutral'][50] || '#fff';
    g.badges.forEach(({node})=>{
      node.style.background=bg;
      node.style.color=fg;
    });
  }
  function scheduleBadgePositioning(){ if(STATE.rafPending) return; STATE.rafPending=true; requestAnimationFrame(()=>{STATE.rafPending=false; positionBadges();}); }
  function positionBadges(){
    if(!STATE.badgeLayer) return; const vw=window.innerWidth, vh=window.innerHeight;
    STATE.groups.forEach(g=>{
      if(!g.badges) return;
      g.badges.forEach(({el,node})=>{
        if(!g.active){ node.style.display='none'; return; }
        const r=el.getBoundingClientRect();
        if(r.bottom<0||r.top>vh||r.right<0||r.left>vw){ node.style.display='none'; return; }
        node.style.display='block';
        const w=node.getBoundingClientRect().width||24;
        let x=Math.round(r.left - w - 6), y=Math.round(r.top - 6);
        if(x<0) x=Math.round(r.right + 6);
        node.style.transform=`translate(${x}px,${y}px)`;
      });
    });
  }

  /* tooltip */
  function initTooltip(){
    if(STATE.tooltipEl) return;
    const tip=document.createElement('div'); tip.id='typoscope-tooltip'; document.body.appendChild(tip); STATE.tooltipEl=tip;
    function showFor(el,e){
      const cs=getComputedStyle(el); const fam=normalizeFamily(cs.fontFamily);
      const w=(cs.fontWeight==='normal')?'400':(cs.fontWeight==='bold')?'700':cs.fontWeight;
      const fs=parsePxFloat(cs.fontSize,0); const lh=deriveLine(cs,fs);
      const ls=cs.letterSpacing==='normal'?0:parsePxFloat(cs.letterSpacing,0);
      tip.innerHTML = `
        <div class="row"><span class="label">Font</span><span class="val">${fam}, ${weightName(w)} (${w})</span></div>
        <div class="row"><span class="label">Text size</span><span class="val">${fmtPx(fs)}</span></div>
        <div class="row"><span class="label">Line height</span><span class="val">${fmtPx(lh)}</span></div>
        <div class="row"><span class="label">Letter spacing</span><span class="val">${fmtPx(ls)}</span></div>`;
      positionTip(e.clientX,e.clientY);
    }
    function positionTip(cx,cy){
      const pad=8, rect=STATE.tooltipEl.getBoundingClientRect();
      let x=cx+12, y=cy+12; if(x+rect.width+pad>window.innerWidth) x=cx-rect.width-12; if(y+rect.height+pad>window.innerHeight) y=cy-rect.height-12;
      STATE.tooltipEl.style.transform=`translate(${Math.max(0,x)}px,${Math.max(0,y)}px)`;
    }
    document.addEventListener('mousemove',e=>{
      const el=e.target&&e.target.closest&&e.target.closest('[data-typoscope][data-typo-active="true"]');
      if(!el){ STATE.tooltipEl.style.transform='translate(-9999px,-9999px)'; return; }
      showFor(el,e);
    });
  }

  /* scanning + summary */
  function clearAll(){
    document.querySelectorAll('[data-typoscope]').forEach(el=>{el.removeAttribute('data-typoscope');el.removeAttribute('data-typo-group');el.removeAttribute('data-typo-active');el.style.transform='';el.style.transition='';});
    if(STATE.styleEl && STATE.styleEl.parentNode) STATE.styleEl.parentNode.removeChild(STATE.styleEl); STATE.styleEl=null;
    if(STATE.badgeLayer && STATE.badgeLayer.parentNode) STATE.badgeLayer.parentNode.removeChild(STATE.badgeLayer); STATE.badgeLayer=null;
    if(STATE.tooltipEl && STATE.tooltipEl.parentNode) STATE.tooltipEl.parentNode.removeChild(STATE.tooltipEl); STATE.tooltipEl=null;
    STATE.groups=[]; STATE.groupsInitialSnapshot=[]; STATE.totalElements=0;

    window.removeEventListener('scroll',scheduleBadgePositioning,true);
    window.removeEventListener('resize',scheduleBadgePositioning,true);
    detachEscListener(); // <--- add
  }

  function scan(rootEl=null){
    clearAll();

    const root=rootEl||document.body;
    const elements=getAllTextElements(8000,root);
    const sizeMap=new Map();

    elements.forEach(el=>{
      const cs=getComputedStyle(el); const fam=normalizeFamily(cs.fontFamily);
      let weight=cs.fontWeight; if(weight==='normal') weight='400'; if(weight==='bold') weight='700';
      const fs=parsePxFloat(cs.fontSize,0), bucket=quantizeSize(fs,STATE.sizeStep);
      const lh=deriveLine(cs,fs); const ls=cs.letterSpacing==='normal'?0:parsePxFloat(cs.letterSpacing,0);

      if(!sizeMap.has(bucket)){
        sizeMap.set(bucket,{ sizePx:bucket, elements:[], familiesCount:new Map(), weights:new Set(), lineHeights:new Set(), letterSpacings:new Set(),
          hue:'neutral', active:true, autoSuppressed:false, anchorSizePx:null, badges:[] });
      }
      const g=sizeMap.get(bucket);
      g.elements.push(el);
      g.weights.add(Number(weight));
      g.lineHeights.add(lh);
      g.letterSpacings.add(ls);
      g.familiesCount.set(fam,(g.familiesCount.get(fam)||0)+1);
    });

    let groups=[...sizeMap.values()].sort((a,b)=>a.sizePx-b.sizePx);
    groups=mergeCloseSizes(groups, STATE.mergeTolerance);
    suppressNearSizes(groups, STATE.nearSizeTolerance);

    const hueMap=computeHueMapForActive(groups);
    groups.forEach(g=>{ if(g.active) g.hue = hueMap.get(g.sizePx)||'slate'; });

    groups.forEach((g,idx)=>{
      g.elements.forEach(el=>{
        el.setAttribute('data-typoscope',''); el.setAttribute('data-typo-group', String(idx)); el.setAttribute('data-typo-active', g.active?'true':'false');
      });
      g.initialActive = g.active;
      g.initialHue = g.hue;
    });

    STATE.groups=groups;
    STATE.groupsInitialSnapshot = groups.map(g => ({
      sizePx: g.sizePx,
      active: g.initialActive,
      autoSuppressed: g.autoSuppressed,
      anchorSizePx: g.anchorSizePx,
      hue: g.initialHue,
      elements: g.elements.slice(),
      weights: new Set(g.weights),
      lineHeights: new Set(g.lineHeights),
      letterSpacings: new Set(g.letterSpacings),
      familiesCount: new Map(g.familiesCount),
    }));

    STATE.totalElements=groups.reduce((s,g)=>s+g.elements.length,0);

    applyStyles();
    buildBadges();
    initTooltip();

    window.addEventListener('scroll',scheduleBadgePositioning,true);
    window.addEventListener('resize',scheduleBadgePositioning,true);
    attachEscListener(); // <--- add
  }

  function summarize(){
    const total = Math.max(1, STATE.totalElements);
    return {
      hues: Object.keys(TAILWIND),
      tw: TAILWIND,
      totalElements: STATE.totalElements,
      sizesUsed: STATE.groups.length,
      groups: STATE.groups.map((g, idx) => ({
        idx,
        sizePx: Math.round(g.sizePx),
        hue: g.hue || 'slate',
        active: !!g.active,
        count: g.elements.length,
        percent: (g.elements.length / total) * 100,
        weightLabel: weightRangeLabel(g.weights) || '—',
        lineLabel:  pxRangeLabel(g.lineHeights) || '—',
        lsLabel:    pxRangeLabel(g.letterSpacings) || '—',
        autoSuppressed: !!g.autoSuppressed,
      })),
    };
  }

  /* -------- region picker (sends summary when done) -------- */
  let picking=false, pickerBox=null, pickerTip=null, pickedRoot=null;
  function startElementPicker(){
    if(picking) return; picking=true;
    const tip=document.createElement('div');
    tip.textContent='Click a container to scan only that region • Esc to cancel';
    Object.assign(tip.style,{position:'fixed',top:'12px',left:'50%',transform:'translateX(-50%)',zIndex:'2147483647',background:'rgba(15,23,42,0.92)',color:'#fff',padding:'6px 10px',borderRadius:'8px',font:'12px Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',border:'1px solid rgba(148,163,184,.6)'}); document.body.appendChild(tip); pickerTip=tip;
    const box=document.createElement('div'); Object.assign(box.style,{position:'fixed',border:'2px solid #22d3ee',background:'rgba(34,211,238,0.08)',zIndex:'2147483646',pointerEvents:'none'}); document.body.appendChild(box); pickerBox=box;
    function positionBox(el){const r=el.getBoundingClientRect(); box.style.left=`${r.left}px`; box.style.top=`${r.top}px`; box.style.width=`${r.width}px`; box.style.height=`${r.height}px`;}
    function onMove(e){const t=document.elementFromPoint(e.clientX,e.clientY); if(!t) return; const el=t.closest('*'); if(!el||el===document.documentElement||el===document.body||el===box) return; positionBox(el); pickedRoot=el;}
    function onClick(e){e.preventDefault();e.stopPropagation(); cleanup(); scan(pickedRoot||document.body); chrome.runtime.sendMessage({type:'typoscope:summary', payload: summarize()});
      // Ask background to reopen the popup after scan is complete
      chrome.runtime.sendMessage({type:'typoscope:openPopup'});
    }
    function onKey(e){if(e.key==='Escape') cleanup();}
    function cleanup(){picking=false;document.removeEventListener('mousemove',onMove,true);document.removeEventListener('click',onClick,true);document.removeEventListener('keydown',onKey,true); if(pickerBox)pickerBox.remove(); if(pickerTip)pickerTip.remove(); pickerBox=null; pickerTip=null;}
    document.addEventListener('mousemove',onMove,true); document.addEventListener('click',onClick,true); document.addEventListener('keydown',onKey,true);
  }

  // --- Esc key clears overlays/results if present ---
  function onContentEscKey(e) {
    if (e.key === 'Escape') {
      // Only clear if overlays/results are present
      if (STATE.groups && STATE.groups.length > 0) {
        clearAll();
      }
    }
  }
  function attachEscListener() {
    window.addEventListener('keydown', onContentEscKey, true);
  }
  function detachEscListener() {
    window.removeEventListener('keydown', onContentEscKey, true);
  }

  /* ---------------- messaging API for popup ---------------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if(!msg||!msg.type) return;
    switch(msg.type){
      case 'typoscope:scanPage': {
        scan();
        sendResponse({ ok:true, summary: summarize() });
        return true;
      }
      case 'typoscope:getSummary': {
        sendResponse({ ok:true, summary: summarize() });
        return true;
      }
      case 'typoscope:toggleGroup': {
        const { idx, active } = msg;
        const g = STATE.groups[idx]; if(!g) { sendResponse({ ok:false }); return; }
        g.active = !!active;
        document.querySelectorAll(`[data-typo-group="${idx}"]`).forEach(el => el.setAttribute('data-typo-active', g.active?'true':'false'));
        if (g.badges) g.badges.forEach(({node}) => node.style.display = g.active ? 'block' : 'none');
        sendResponse({ ok:true, summary: summarize() });
        return true;
      }
      case 'typoscope:setHue': {
        const { idx, hue } = msg;
        const g = STATE.groups[idx]; if(!g) { sendResponse({ ok:false }); return; }
        g.hue = hue;
        updateBadgeColorsForGroup(idx);
        applyStyles();
        sendResponse({ ok:true, summary: summarize() });
        return true;
      }
      case 'typoscope:reset': {
        STATE.groups.forEach((g,i)=>{
          const s=STATE.groupsInitialSnapshot[i];
          g.active=s.active; g.hue=s.hue;
          document.querySelectorAll(`[data-typo-group="${i}"]`).forEach(el => el.setAttribute('data-typo-active', g.active?'true':'false'));
          if (g.badges) g.badges.forEach(({node}) => node.style.display = g.active ? 'block' : 'none');
          updateBadgeColorsForGroup(i);
        });
        applyStyles();
        sendResponse({ ok:true, summary: summarize() });
        return true;
      }
      case 'typoscope:selectRegion': {
        startElementPicker();
        sendResponse({ ok:true });
        return true;
      }
      case 'typoscope:clear': {
        clearAll();
        sendResponse({ ok:true });
        return true;
      }
      default: break;
    }
// keep badges placed
const mo = new MutationObserver(() => scheduleBadgePositioning());
mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, characterData:true });
  });

  // keep badges placed
  const mo = new MutationObserver(() => scheduleBadgePositioning());
  mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, characterData:true });
})();
