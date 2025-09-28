/* global chrome */

const mount = document.getElementById('mount');
const btnBack = document.getElementById('btnBack');
const btnRight = document.getElementById('btnRight');

let didAnimateResults = false; // animate only the first time results appear
let initialActiveStates = []; // Track initial checkbox states

function sendToTab(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return resolve(null);
      chrome.tabs.sendMessage(tabs[0].id, message, (res) => resolve(res || null));
    });
  });
}

/* header modes */
function setHeader(mode){
  if(mode==='default'){
    // Clear overlays when going back to default
    sendToTab({ type: 'typoscope:clear' });
    document.body.classList.remove('results');
    btnBack.style.visibility = 'hidden';
    btnBack.onclick = null;
    btnRight.style.visibility = 'hidden';
    btnRight.onclick = null;
    document.removeEventListener('keydown', onPopupEsc, true); // Remove Esc handler
  }else{
    document.body.classList.add('results');
    btnBack.style.visibility = 'visible';
    btnBack.onclick = () => renderActions();
    btnRight.style.visibility = 'visible';
    btnRight.onclick = async () => {
      const list = document.querySelector('.list');
      const keepScroll = list ? list.scrollTop : 0;
      const res = await sendToTab({ type:'typoscope:reset' });
      if (res?.ok) renderResults(res.summary, { preserveScroll: true, scrollTop: keepScroll, animate: false });
    };
    document.addEventListener('keydown', onPopupEsc, true); // Add Esc handler
  }
}

// Esc handler for popup: clear overlays/results and go to default state on first Esc
function onPopupEsc(e) {
  if (e.key === 'Escape') {
    // Only act if in results mode
    if (document.body.classList.contains('results')) {
      sendToTab({ type: 'typoscope:clear' });
      renderActions();
      e.stopPropagation();
      e.preventDefault();
    }
  }
}

/* default view (homepage) */
function renderActions(){
  initialActiveStates = [];
  didAnimateResults = false; // <-- Reset animation state on home
  setHeader('default');
  mount.innerHTML = `
    <div class="row-actions">
      <div class="actions">
        <button id="scanPage" class="btn btn-scan-page">
          <span class="icon">
<svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4.66659 3.1665H2.33325V5.49984M12.3333 3.1665H14.6666V5.49984M14.6666 10.4998V12.8332H12.3333M4.66659 12.8332H2.33325V10.4998" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="1.5" stroke-linecap="square"/>
<path d="M5.66675 6.5H11.3334" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="1.5" stroke-linecap="square"/>
<path d="M5.66675 9.5H10.0001" stroke="white" style="stroke:white;stroke-opacity:1;" stroke-width="1.5" stroke-linecap="square"/>
</svg>

          </span>
          <span class="label" style="color:#fff">Scan page</span>
        </button>
        <button id="scanRegion" class="btn btn-scan-section">
          <span class="icon">
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M13.5 2.5H14.25V1.75H13.5V2.5ZM13.5 13.5V14.25H14.25V13.5H13.5ZM2.5 13.5H1.75V14.25H2.5V13.5ZM2.5 2.5V1.75H1.75V2.5H2.5ZM13.5 2.5H12.75V13.5H13.5H14.25V2.5H13.5ZM13.5 13.5V12.75H2.5V13.5V14.25H13.5V13.5ZM2.5 13.5H3.25V2.5H2.5H1.75V13.5H2.5ZM2.5 2.5V3.25H13.5V2.5V1.75H2.5V2.5Z" fill="#3D3D3D" style="fill:#3D3D3D;fill:color(display-p3 0.2392 0.2392 0.2392);fill-opacity:1;"/>
<path d="M8 8.75H7.25V10.25H8V9.5V8.75ZM13.5 10.25H14.25V8.75H13.5V9.5V10.25ZM8 9.5V10.25H13.5V9.5V8.75H8V9.5Z" fill="#3D3D3D" style="fill:#3D3D3D;fill:color(display-p3 0.2392 0.2392 0.2392);fill-opacity:1;"/>
<path d="M8 7.25H8.75V5.75H8V6.5V7.25ZM2.5 5.75H1.75V7.25H2.5V6.5V5.75ZM8 6.5V5.75H2.5V6.5V7.25H8V6.5Z" fill="#3D3D3D" style="fill:#3D3D3D;fill:color(display-p3 0.2392 0.2392 0.2392);fill-opacity:1;"/>
<path d="M7.25 13.5V14.25H8.75V13.5H8H7.25ZM8.75 2.5V1.75H7.25V2.5H8H8.75ZM8 2.5H7.25V13.5H8H8.75V2.5H8Z" fill="#3D3D3D" style="fill:#3D3D3D;fill:color(display-p3 0.2392 0.2392 0.2392);fill-opacity:1;"/>
</svg>

          </span>
          <span class="label">Scan section</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('scanPage').addEventListener('click', async () => {
    const res = await sendToTab({ type: 'typoscope:scanPage' });
    if (res?.ok) renderResults(res.summary, { animate: true });
  });
  document.getElementById('scanRegion').addEventListener('click', async () => {
    await sendToTab({ type: 'typoscope:selectRegion' });
    window.close(); // Close the popup so user can interact with the page
    // summary will be pushed; see listener below
  });
}

/* Helper: check if any group checkbox state has changed from initial */
function hasCheckboxStateChanged(summary) {
  if (!summary || !summary.groups) return false;
  return summary.groups.some((g, i) => initialActiveStates[i] !== g.active);
}

/* results view */
function renderResults(summary, opts = {}) {
  const { preserveScroll = false, scrollTop = 0 } = opts;

  setHeader('results');

  // Only update initialActiveStates if it's empty or group count changed
  if (!initialActiveStates.length || initialActiveStates.length !== summary.groups.length) {
    initialActiveStates = summary.groups ? summary.groups.map(g => g.active) : [];
  }

  // Capture current scroll before re-render (prevents jump-to-top)
  const listElExisting = document.querySelector('.list');
  const keepScrollTop = preserveScroll && listElExisting ? listElExisting.scrollTop : 0;

  mount.innerHTML = `<div class="list" id="list"></div>`;
  const list = document.getElementById('list');
  const { groups, tw } = summary;

  // Show/hide reset button based on checkbox state
  if (hasCheckboxStateChanged(summary)) {
    btnRight.style.visibility = 'visible';
  } else {
    btnRight.style.visibility = 'hidden';
  }

  // Inject animation stylesheet once (doesn't change your existing CSS)
  if (!document.getElementById('ts-anim-styles')) {
    const style = document.createElement('style');
    style.id = 'ts-anim-styles';
    style.textContent = `
      @keyframes tsFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .ts-enter{opacity:0;will-change:opacity,transform;animation:tsFadeUp .32s ease-out forwards}
    `;
    document.head.appendChild(style);
  }

  groups.forEach((g, i) => {
    const bg = tw[g.hue]?.[600] || '#000';
    const fg = tw[g.hue]?.[50] || '#fff';
    const row = document.createElement('div');
    row.className = 'item' + (!didAnimateResults && (opts.animate ?? true) ? ' ts-enter' : '');
    if (!didAnimateResults && (opts.animate ?? true)) row.style.animationDelay = `${i * 40}ms`;

    row.innerHTML = `
      <div class="sizebox" style="background:${bg};color:${fg}" data-idx="${g.idx}" title="Pick color">
        <span class="num" style="color:${fg}">${g.sizePx}</span><span class="unit" style="color:${fg}">px</span>
      </div>
      <div class="right">
        <div class="pills">
          <div class="pill">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.04163 3.20841V2.04175H6.99996M11.9583 3.20841V2.04175H6.99996M6.99996 2.04175V11.9584M6.99996 11.9584H5.54163M6.99996 11.9584H8.45829" stroke="#3D3D3D" stroke-linecap="square"/></svg>
            <span class="label">${g.weightLabel}</span>
          </div>
          <div class="pill">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5416 11.375L1.45829 11.375" stroke="#3D3D3D" stroke-linecap="square"/>
              <path d="M12.5416 2.625L1.45829 2.625" stroke="#3D3D3D" stroke-linecap="square"/>
              <path d="M8.45837 8.16667L7.00004 9.625L5.54171 8.16667" stroke="#3D3D3D" stroke-linecap="square"/>
              <path d="M8.45837 5.83325L7.00004 4.37492L5.54171 5.83325" stroke="#3D3D3D" stroke-linecap="square"/>
            </svg>
            <span class="label">${g.lineLabel}</span>
          </div>
        </div>
        <div class="pills">
          <div class="pill" title="Letter spacing">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform:rotate(90deg)">
              <path d="M12.5416 11.375L1.45829 11.375" stroke="#3D3D3D" stroke-linecap="square"/>
              <path d="M12.5416 2.625L1.45829 2.625" stroke="#3D3D3D" stroke-linecap="square"/>
              <path d="M8.45837 8.16667L7.00004 9.625L5.54171 8.16667" stroke="#3D3D3D" stroke-linecap="square"/>
              <path d="M8.45837 5.83325L7.00004 4.37492L5.54171 5.83325" stroke="#3D3D3D" stroke-linecap="square"/>
            </svg>
            <span class="label">${g.lsLabel}</span>
          </div>
          <div class="pill" title="${g.count} elements">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c)"><path d="M1.458 7.0001C1.458 10.0607 3.93908 12.5418 7.00066 12.5418C10.0606 12.5418 12.5417 10.0607 12.5417 7.0001C12.5417 4.58722 10.9996 2.53452 8.84788 1.77377M1.458 7.0001C1.458 3.93952 3.93908 1.45843 7.00066 1.45843C7.64836 1.45843 8.27011 1.56955 8.84788 1.77377M1.458 7.0001H7.00066L8.84788 1.77377" stroke="#3D3D3D"/></g><defs><clipPath id="c"><rect width="14" height="14" transform="matrix(0 -1 1 0 0 14)" fill="white"/></clipPath></defs></svg>
            <span class="label">${((g.count/summary.totalElements)*100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
      <div class="chk${g.active ? ' on' : ''}" data-idx="${g.idx}" role="checkbox" aria-checked="${g.active ? 'true':'false'}" title="Toggle">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#k)"><path d="M1.25 6.25008L3.87255 8.33341L8.75 1.66675" stroke="white" stroke-width="2" stroke-linecap="square"/></g><defs><clipPath id="k"><rect width="10" height="10" fill="white"/></clipPath></defs></svg>
      </div>
    `;

    // interactions
    // Remove animation logic, just toggle state directly
    const chk = row.querySelector('.chk');
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGroup(g.idx, !g.active);
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('.sizebox') || e.target.closest('.chk')) return;
      toggleGroup(g.idx, !g.active);
    });
    row.querySelector('.sizebox').addEventListener('click', (e) => {
      e.stopPropagation(); openHuePicker(e.currentTarget, g.idx, summary);
    });

    list.appendChild(row);
  });

  // restore scroll position if asked
  if (preserveScroll) {
    list.scrollTop = scrollTop || keepScrollTop;
  }

  // mark that we already ran the entry animation once
  if (!didAnimateResults && (opts.animate ?? true)) {
    didAnimateResults = true;
  }
}

/* toggle/update helpers — always preserve scroll */
async function toggleGroup(idx, active){
  const list = document.querySelector('.list');
  const keepScroll = list ? list.scrollTop : 0;
  const res = await sendToTab({ type:'typoscope:toggleGroup', idx, active });
  if (res?.ok) {
    renderResults(res.summary, { preserveScroll: true, scrollTop: keepScroll, animate: false });
  }
}

function openHuePicker(anchorEl, groupIdx, summary){
  let picker = document.querySelector('.picker');
  if (!picker){ picker = document.createElement('div'); picker.className='picker'; document.body.appendChild(picker); }
  picker.innerHTML='';

  summary.hues.forEach(h=>{
    const cell=document.createElement('div');
    cell.className='hue'; cell.textContent='Aa';
    cell.style.background = summary.tw[h][500];
    cell.title = h;
    cell.addEventListener('click', async (ev)=>{
      ev.stopPropagation();
      const list = document.querySelector('.list');
      const keepScroll = list ? list.scrollTop : 0;
      const res = await sendToTab({ type:'typoscope:setHue', idx: groupIdx, hue: h });
      picker.style.display='none';
      if (res?.ok) renderResults(res.summary, { preserveScroll: true, scrollTop: keepScroll, animate: false });
    });
    picker.appendChild(cell);
  });

  const r = anchorEl.getBoundingClientRect();
  picker.style.left = `${Math.round(r.left)}px`;
  picker.style.top  = `${Math.round(r.bottom + 6)}px`;
  picker.style.display='grid';

  const close=(ev)=>{ if(!ev.target.closest('.picker')){ picker.style.display='none'; document.removeEventListener('mousedown',close,true);} };
  document.addEventListener('mousedown',close,true);
}

/* accept summaries pushed after section-pick (animate first time) */
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'typoscope:summary') {
    didAnimateResults = false;
    renderResults(msg.payload, { animate: true });
  }
});

/* boot: show results if already scanned else homepage */
(async () => {
  const res = await sendToTab({ type:'typoscope:getSummary' });
  if (res?.ok && res.summary?.groups?.length) {
    didAnimateResults = false; // <-- Always animate on boot if results
    renderResults(res.summary, { animate: true });
  } else {
    renderActions();
  }
})();
