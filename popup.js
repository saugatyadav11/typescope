/* global chrome */

const mount = document.getElementById('mount');
const btnBack = document.getElementById('btnBack');
const btnRight = document.getElementById('btnRight');

let didAnimateResults = false; // animate only the first time results appear
let initialActiveStates = []; // Track initial checkbox states

function sendToTab(message) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const primary = tabs && tabs[0];
      const isExtensionTab = primary && primary.url && primary.url.startsWith('chrome-extension://');

      const send = (tab) => {
        if (!tab) return resolve(null);
        chrome.tabs.sendMessage(tab.id, message, (res) => resolve(res || null));
      };

      if (primary && !isExtensionTab) {
        send(primary);
        return;
      }

      chrome.tabs.query({ active: true, windowType: 'normal', lastFocusedWindow: true }, (fallbackTabs) => {
        const pageTab = (fallbackTabs || []).find(tab => tab.url && !tab.url.startsWith('chrome-extension://')) || null;
        if (pageTab) {
          send(pageTab);
        } else {
          chrome.tabs.query({ windowType: 'normal' }, (allNormalTabs) => {
            const firstNormal = (allNormalTabs || []).find(tab => tab.active);
            send(firstNormal || allNormalTabs?.[0] || null);
          });
        }
      });
    });
  });
}

function removeHomeGrids() {
  document.querySelectorAll('.home-grid').forEach(el => el.remove());
}


/* header modes */
function setHeader(mode){
  if(mode==='default'){
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
      if (res?.ok) await renderResults(res.summary, { preserveScroll: true, scrollTop: keepScroll, animate: false });
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
async function renderActions(opts = {}){
  const { clear = true } = opts;
  initialActiveStates = [];
  didAnimateResults = false; // <-- Reset animation state on home
  setHeader('default');
  removeHomeGrids();
  if (clear) await sendToTab({ type: 'typoscope:clear' });
  mount.innerHTML = `
    <div class="home-layout">
      <div class="home-main">
        <div class="home-main-content">
          <div class="home-actions">
            <button id="scanPage" class="btn btn-scan-page">
              <span class="icon">
<svg width="20" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M3.83325 18.3337V1.66699H17.1666V13.3932C17.1666 14.137 16.9227 14.8602 16.4724 15.4544C15.0978 17.2678 12.9418 18.3337 10.6539 18.3337H3.83325ZM16.3333 13.079C16.3333 13.5198 16.182 13.8208 15.9566 14.0339C15.7211 14.2566 15.3752 14.4096 14.9558 14.4828C14.1033 14.6317 13.1022 14.4253 12.5343 14.0507L12.2521 13.8645L11.0596 15.0444C9.47088 16.6164 7.31516 17.5003 5.06645 17.5003H4.66659V2.50033H16.3333V13.079Z" fill="white" style="fill:white;fill-opacity:1;"/>
</svg>
              </span>
              <span class="label" style="color:#fff">Scan page</span>
            </button>
            <button id="scanRegion" class="btn btn-scan-section">
              <span class="icon">
<svg width="20" height="20" viewBox="0 0 21 20" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3.41675 5.00033V2.91699H5.50008M15.5001 2.91699H17.5834V5.00033M17.5834 15.0003V17.0837H15.5001M5.50008 17.0837H3.41675V15.0003M3.41675 11.667V8.33366M8.83341 2.91699H12.1667M17.5834 8.33366V11.667M12.1667 17.0837H8.83341" stroke="#3D3D3D" style="stroke:#3D3D3D;stroke:color(display-p3 0.2392 0.2392 0.2392);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
</svg>
              </span>
              <span class="label">Scan section</span>
            </button>
          </div>
          <a class="home-credit" href="https://x.com/saugattttt" target="_blank" rel="noopener noreferrer">
            <span>Designed by</span>
            <span class="home-credit-name">Saugat</span>
          </a>
        </div>
      </div>
    </div>
  `;

  const colorPalette = [
    '#3C9F56','#DC374F','#DF5E44','#33ACBC','#8356E2','#2CAC88','#4F71F6'
  ];
  const sizeChoices = [10,12,16,20,24,32,40,48];
  const card = document.querySelector('.ts-card');
  const main = document.querySelector('.home-main');
  const grids = (() => {
    if (!card) return [];
    const left = document.createElement('div');
    left.className = 'home-grid home-grid-left';
    const right = document.createElement('div');
    right.className = 'home-grid home-grid-right';
    card.appendChild(left);
    card.appendChild(right);
    return [left, right];
  })();

  const cardRect = card?.getBoundingClientRect();
  grids.forEach(grid => {
    if (!grid) return;
    if (grid.classList.contains('home-grid-left')) grid.style.left = '0';
    if (grid.classList.contains('home-grid-right')) grid.style.right = '0';
  });

  const totalHeight = cardRect ? cardRect.height : 0;
  const rows = Math.max(10, Math.ceil((totalHeight + 80) / 40));

  grids.forEach(grid => {
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < rows * 2; i++) {
      const cell = document.createElement('div');
      cell.className = 'home-grid-cell';
      cell.addEventListener('mouseenter', () => {
        if (cell._badgeTimeout) {
          clearTimeout(cell._badgeTimeout);
          cell._badgeTimeout = null;
        }
        const existing = cell.querySelector('.grid-badge');
        if (existing) existing.remove();
        const badge = document.createElement('span');
        badge.className = 'grid-badge';
        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const value = sizeChoices[Math.floor(Math.random() * sizeChoices.length)];
        badge.style.background = color;
        badge.textContent = value;
        cell.appendChild(badge);
        cell._badgeTimeout = window.setTimeout(() => {
          if (badge.isConnected) badge.classList.add('on');
          cell._badgeTimeout = null;
        }, 70);
      });
      cell.addEventListener('mouseleave', () => {
        if (cell._badgeTimeout) {
          clearTimeout(cell._badgeTimeout);
          cell._badgeTimeout = null;
        }
        const badge = cell.querySelector('.grid-badge');
        if (badge) {
          badge.classList.remove('on');
          badge.classList.add('fade');
          setTimeout(() => { if (badge.isConnected) badge.remove(); }, 260);
        }
      });
      grid.appendChild(cell);
    }
  });

  document.getElementById('scanPage').addEventListener('click', async () => {
    const res = await sendToTab({ type: 'typoscope:scanPage' });
    if (res?.ok) await renderResults(res.summary, { animate: true });
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
async function renderResults(summary, opts = {}) {
  const { preserveScroll = false, scrollTop = 0 } = opts;
  const animate = opts.animate ?? true;

  setHeader('results');
  removeHomeGrids();

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
    row.className = 'item' + (!didAnimateResults && animate ? ' ts-enter' : '');
    if (!didAnimateResults && animate) row.style.animationDelay = `${i * 40}ms`;

    row.innerHTML = `
      <div class="sizebox" data-idx="${g.idx}" title="Pick color">
        <div class="sizebox-swatch" style="background:${bg};color:${fg}">${g.sizePx}</div>
      </div>
      <div class="item-body">
        <div class="meta-row meta-row-top">
          <div class="meta" title="Primary font family">
            <span class="meta-icon">
              <svg width="17" height="17" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.583252 10.7272H1.79617L2.48264 8.71422H5.35236L6.03366 10.7272H7.24658L4.54202 3.2793H3.29297L0.583252 10.7272ZM3.90718 4.51286H3.92782L5.03752 7.78518H2.79232L3.90718 4.51286Z" fill="#494949" style="fill:#494949;fill:color(display-p3 0.2869 0.2869 0.2869);fill-opacity:1;"/><path d="M10.0306 10.8252C10.7481 10.8252 11.3777 10.4536 11.6926 9.87037H11.7132V10.7272H12.8333V6.98516C12.8333 5.89611 11.9919 5.19417 10.6655 5.19417C9.32868 5.19417 8.51835 5.9116 8.44093 6.84581L8.43576 6.90258H9.48868L9.49901 6.85613C9.59191 6.42257 9.98934 6.11805 10.6345 6.11805C11.3261 6.11805 11.7132 6.47935 11.7132 7.07807V7.48582L10.2371 7.57356C8.9519 7.65098 8.21899 8.22905 8.21899 9.17358V9.18391C8.21899 10.1594 8.94674 10.8252 10.0306 10.8252ZM9.34417 9.1581V9.14778C9.34417 8.68842 9.71578 8.39422 10.3868 8.35293L11.7132 8.27034V8.69358C11.7132 9.40069 11.1197 9.93231 10.3351 9.93231C9.73643 9.93231 9.34417 9.63295 9.34417 9.1581Z" fill="#494949" style="fill:#494949;fill:color(display-p3 0.2869 0.2869 0.2869);fill-opacity:1;"/></svg>
            </span>
            <div class="meta-text">
              <span class="meta-label">${g.familyLabel || '—'}</span>
            </div>
          </div>
          <div class="meta" title="Font weight">
            <span class="meta-icon">
            <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1.89575 3.47884V2.39551H6.49992M11.1041 3.47884V2.39551H6.49992M6.49992 2.39551V11.6038M6.49992 11.6038H5.14575M6.49992 11.6038H7.85409" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
</svg>
            </span>
            <div class="meta-text">
              <span class="meta-label">${g.weightLabel}</span>
            </div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta" title="Line height">
            <span class="meta-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M12.5417 11.375L1.45841 11.375" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
<path d="M12.5417 2.625L1.45841 2.625" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
<path d="M8.45825 8.16667L6.99992 9.625L5.54159 8.16667" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
<path d="M8.45825 5.83301L6.99992 4.37467L5.54159 5.83301" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
</svg>

            </span>
            <div class="meta-text">
              <span class="meta-label">${g.lineLabel}</span>
            </div>
          </div>
          <div class="meta" title="Letter spacing">
            <span class="meta-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M2.77075 12.3955L2.77075 1.60384" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
<path d="M11.2292 12.3955V1.60384" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
<path d="M5.83325 8.3125L4.52075 7L5.83325 5.6875" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
<path d="M8.3125 8.3125L9.625 7L8.3125 5.6875" stroke="#494949" style="stroke:#494949;stroke:color(display-p3 0.2869 0.2869 0.2869);stroke-opacity:1;" stroke-width="1.2" stroke-linecap="square"/>
</svg>

            </span>
            <div class="meta-text">
              <span class="meta-label">${g.lsLabel}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="chk${g.active ? ' on' : ''}" data-idx="${g.idx}" role="checkbox" aria-checked="${g.active ? 'true':'false'}" title="Toggle">
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#k)"><path d="M1.25 6.25008L3.87255 8.33341L8.75 1.66675" stroke="white" stroke-width="2" stroke-linecap="square"/></g><defs><clipPath id="k"><rect width="10" height="10" fill="white"/></clipPath></defs></svg>
      </div>
    `;

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
      e.stopPropagation();
      openHuePicker(e.currentTarget, g.idx, summary);
    });

    list.appendChild(row);
  });

  // restore scroll position if asked
  if (preserveScroll) {
    list.scrollTop = scrollTop || keepScrollTop;
  }

  // mark that we already ran the entry animation once
  if (!didAnimateResults && animate) {
    didAnimateResults = true;
  }

}

/* toggle/update helpers — always preserve scroll */
async function toggleGroup(idx, active){
  const list = document.querySelector('.list');
  const keepScroll = list ? list.scrollTop : 0;
  const res = await sendToTab({ type:'typoscope:toggleGroup', idx, active });
  if (res?.ok) {
    await renderResults(res.summary, { preserveScroll: true, scrollTop: keepScroll, animate: false });
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
      if (res?.ok) await renderResults(res.summary, { preserveScroll: true, scrollTop: keepScroll, animate: false });
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
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === 'typoscope:summary') {
    didAnimateResults = false;
    await renderResults(msg.payload, { animate: true });
  }
});

/* boot: show results if already scanned else homepage */
(async () => {
  let summaryRes = null;

  try {
    summaryRes = await sendToTab({ type: 'typoscope:getSummary' });
  } catch (err) {
    summaryRes = null;
  }

  if (summaryRes?.ok && summaryRes.summary?.groups?.length) {
    didAnimateResults = false; // <-- Always animate on boot if results
    await renderResults(summaryRes.summary, { animate: true });
    return;
  }

  renderActions();
})();
