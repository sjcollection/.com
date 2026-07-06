// Keep your API setup as requested
const SHEET_ID = '1FfhN47psQiWAEUzNYpowfOZiHYC7a38MdiFUrVRBb8Y';
const API_KEY = 'AIzaSyDbPZ-hFkQuEISkMPzkTlaT2MHY1DhPbvE';

const norm = (v) => String(v ?? '').trim();
const lower = (v) => norm(v).toLowerCase();

async function fetchSheetData(sheet, range = 'A:H') {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(`${sheet}!${range}`)}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.values || []).slice(1);
}

function fallback(el, txt = 'No Image') {
  el.src = `https://via.placeholder.com/300x400?text=${encodeURIComponent(txt)}`;
}

function openPlayable(link) {
  if (!link) return alert('No link found.');
  window.open(link, '_blank', 'noopener,noreferrer');
}

function backToCategory() {
  window.location.href = 'category.html';
}
window.backToCategory = backToCategory;

/* list nav reset */
function resetListViewAndGoList(e) {
  if (e) e.preventDefault();
  sessionStorage.removeItem('selectedListView');
  sessionStorage.removeItem('selectedListImageMode');
  window.location.href = 'list.html';
}
window.resetListViewAndGoList = resetListViewAndGoList;

function bindListNavReset() {
  document.querySelectorAll('.nav-menu a').forEach((a) => {
    const txt = a.textContent.trim().toUpperCase();

    if (txt === 'MORE LIST') {
      a.addEventListener('click', resetListViewAndGoList);
    }

    if (txt === 'MORE ACCESS') {
      a.addEventListener('click', () => {
        sessionStorage.removeItem('selectedListView');
        sessionStorage.removeItem('selectedListImageMode');
      });
    }
  });
}

/* =========================
   BUILT-IN PIN MODULE
   ========================= */
const PIN_SAVE_KEY_PREFIX = 'sj_saved_pin_';
let PIN_CACHE = [];
let pinCurrentCategory = '';
let pinSuccessCallback = null;
let pinUiReady = false;

function ensurePinMarkup() {
  if (document.getElementById('pinOverlay')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="pinOverlay" class="pin-overlay" aria-hidden="true">
      <div class="pin-modal" role="dialog" aria-modal="true" aria-labelledby="pinTitle">
        <div class="pin-head">
          <h3 id="pinTitle" class="pin-title">Enter Access PIN</h3>
          <button id="pinCloseBtn" class="pin-close" type="button" aria-label="Close">&times;</button>
        </div>

        <p class="pin-sub">Please enter your 4-digit PIN to continue.</p>
        <div id="pinCategoryLabel" class="pin-category">CATEGORY</div>

        <div class="pin-input-wrap">
          <input
            id="pinInput"
            class="pin-input"
            type="password"
            inputmode="numeric"
            maxlength="4"
            placeholder="••••"
            autocomplete="off"
          />
          <button
            id="pinToggleBtn"
            class="pin-toggle"
            type="button"
            aria-label="Show PIN"
            title="Show PIN"
          >&#128065;&#65039;</button>
        </div>

        <div class="pin-row">
          <label class="pin-remember">
            <input id="pinRemember" type="checkbox" />
            Save PIN for this category
          </label>
        </div>

        <div class="pin-actions">
          <button id="pinCancelBtn" class="pin-btn cancel" type="button">Cancel</button>
          <button id="pinSubmitBtn" class="pin-btn submit" type="button">Unlock</button>
        </div>

        <div id="pinMessage" class="pin-msg"></div>
      </div>
    </div>
  `;

  document.body.appendChild(wrap.firstElementChild);
}

function pinEl(id) {
  return document.getElementById(id);
}

function clearPinMsg() {
  const el = pinEl('pinMessage');
  if (!el) return;
  el.className = 'pin-msg';
  el.textContent = '';
}

function setPinMsg(text, type = 'error') {
  const el = pinEl('pinMessage');
  if (!el) return;
  el.className = `pin-msg ${type}`;
  el.textContent = text;
}

function shakePin() {
  const modal = document.querySelector('.pin-modal');
  if (!modal) return;
  modal.classList.remove('pin-shake');
  void modal.offsetWidth;
  modal.classList.add('pin-shake');
}

async function loadPinSheet() {
  if (PIN_CACHE.length) return PIN_CACHE;

  const rows = await fetchSheetData('PIN', 'A:B');
  PIN_CACHE = rows
    .map((r) => ({
      category: norm(r[0]),
      pin: norm(r[1])
    }))
    .filter((x) => x.category && x.pin);

  return PIN_CACHE;
}

function getAllowedPins(categoryName) {
  const cat = lower(categoryName);
  const fullPins = PIN_CACHE.filter((x) => lower(x.category) === 'full').map((x) => x.pin);
  const catPins = PIN_CACHE.filter((x) => lower(x.category) === cat).map((x) => x.pin);
  return [...new Set([...catPins, ...fullPins])];
}

function getSavedPin(categoryName) {
  return localStorage.getItem(PIN_SAVE_KEY_PREFIX + lower(categoryName)) || '';
}

function setSavedPin(categoryName, pin) {
  localStorage.setItem(PIN_SAVE_KEY_PREFIX + lower(categoryName), pin);
}

function clearSavedPin(categoryName) {
  localStorage.removeItem(PIN_SAVE_KEY_PREFIX + lower(categoryName));
}

function setPinToggleState(isVisible) {
  const btn = pinEl('pinToggleBtn');
  if (!btn) return;

  btn.innerHTML = isVisible ? '&#128584;' : '&#128065;&#65039;';
  btn.setAttribute('aria-label', isVisible ? 'Hide PIN' : 'Show PIN');
  btn.setAttribute('title', isVisible ? 'Hide PIN' : 'Show PIN');
}

function closePinModal() {
  const ov = pinEl('pinOverlay');
  if (!ov) return;

  ov.classList.remove('show');
  ov.setAttribute('aria-hidden', 'true');
  clearPinMsg();

  pinCurrentCategory = '';
  pinSuccessCallback = null;
}

function openPinModal(categoryName, onSuccess) {
  pinCurrentCategory = categoryName;
  pinSuccessCallback = onSuccess;

  const label = pinEl('pinCategoryLabel');
  const input = pinEl('pinInput');
  const remember = pinEl('pinRemember');
  const ov = pinEl('pinOverlay');

  label.textContent = categoryName.toUpperCase();

  const saved = getSavedPin(categoryName);
  input.type = 'password';
  input.value = saved;
  remember.checked = !!saved;

  setPinToggleState(false);
  clearPinMsg();

  ov.classList.add('show');
  ov.setAttribute('aria-hidden', 'false');

  setTimeout(() => input.focus(), 20);
}

async function submitPin() {
  const entered = norm(pinEl('pinInput').value);

  if (!/^\d{4}$/.test(entered)) {
    setPinMsg('Please enter a valid 4-digit PIN.', 'error');
    shakePin();
    return;
  }

  await loadPinSheet();
  const allowed = getAllowedPins(pinCurrentCategory);

  if (!allowed.length) {
    const cb = pinSuccessCallback;
    closePinModal();
    if (typeof cb === 'function') cb();
    return;
  }

  if (!allowed.includes(entered)) {
    setPinMsg('Wrong PIN. Please try again.', 'error');
    shakePin();
    return;
  }

  if (pinEl('pinRemember').checked) {
    setSavedPin(pinCurrentCategory, entered);
  } else {
    clearSavedPin(pinCurrentCategory);
  }

  setPinMsg('PIN verified. Access granted.', 'ok');

  setTimeout(() => {
    const cb = pinSuccessCallback;
    closePinModal();
    if (typeof cb === 'function') cb();
  }, 150);
}

async function requireCategoryPin(categoryName, onSuccess) {
  await loadPinSheet();
  const allowed = getAllowedPins(categoryName);

  if (!allowed.length) {
    if (typeof onSuccess === 'function') onSuccess();
    return;
  }

  const saved = getSavedPin(categoryName);
  if (saved && allowed.includes(saved)) {
    if (typeof onSuccess === 'function') onSuccess();
    return;
  }

  openPinModal(categoryName, onSuccess);
}

function initPinUI() {
  if (pinUiReady) return;
  pinUiReady = true;

  ensurePinMarkup();

  pinEl('pinCloseBtn').addEventListener('click', closePinModal);
  pinEl('pinCancelBtn').addEventListener('click', closePinModal);
  pinEl('pinSubmitBtn').addEventListener('click', submitPin);

  pinEl('pinOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'pinOverlay') closePinModal();
  });

  pinEl('pinInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitPin();
  });

  pinEl('pinInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
  });

  pinEl('pinToggleBtn').addEventListener('click', () => {
    const input = pinEl('pinInput');
    const isHidden = input.type === 'password';

    input.type = isHidden ? 'text' : 'password';
    setPinToggleState(isHidden);
    input.focus();
  });
}

/* =========================
   MAIN APP
   ========================= */

async function loadCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  const rows = await fetchSheetData('CATEGORIES', 'A:F');
  const all = rows
    .map((r) => ({
      id: norm(r[0]),
      title: norm(r[1]),
      desc: norm(r[2]),
      pic: norm(r[3]),
      group: norm(r[4]),
      imageMode: norm(r[5]) || '1'
    }))
    .filter((x) => x.id && x.title && x.group);

  grid.innerHTML = '';

  const grouped = {};
  all.forEach((x) => {
    const g = x.group.toUpperCase();
    (grouped[g] ??= []).push(x);
  });

  const preferredOrder = ['STREAMING', 'GAMING', 'READING', 'FOR KIDS ACCESS', 'MUSIC'];
  const groupNames = Object.keys(grouped).sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  groupNames.forEach((groupName) => {
    const items = grouped[groupName] || [];
    if (!items.length) return;

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = groupName;
    grid.appendChild(header);

    items.forEach((x) => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <img class="card-image" src="${x.pic}" alt="${x.title}">
        <div class="card-content">
          <h3 class="card-title">${x.title}</h3>
          <p class="card-description">${x.desc || ''}</p>
          <button class="card-button">ACCESS 🔐</button>
        </div>
      `;

      const img = card.querySelector('img');
      img.onerror = () => fallback(img, x.title);

      card.querySelector('button').onclick = () => {
        requireCategoryPin(x.title, () => {
          sessionStorage.setItem('selectedCategory', x.title);
          sessionStorage.setItem('selectedCategoryImageMode', x.imageMode);
          location.href = 'category.html';
        });
      };

      grid.appendChild(card);
    });
  });
}

async function loadCategoryPage() {
  const grid = document.getElementById('contentGrid');
  if (!grid) return;

  const selected = sessionStorage.getItem('selectedCategory') || '';
  const selectedImageMode = norm(sessionStorage.getItem('selectedCategoryImageMode') || '1');
  const useLandscape = selectedImageMode === '2';

  const titleEl = document.getElementById('categoryTitle');
  if (titleEl) titleEl.textContent = selected || 'Category';

  const rows = await fetchSheetData('ACCESS', 'A:F');
  const items = rows
    .map((r) => ({
      category: norm(r[0]),
      id: norm(r[1]),
      title: norm(r[2]),
      type: lower(r[3]),
      pic: norm(r[4]),
      meta: norm(r[5])
    }))
    .filter((x) => lower(x.category) === lower(selected) && x.id && x.title);

  const uniq = [...new Map(items.map((i) => [i.id, i])).values()]
    .sort((a, b) => a.title.localeCompare(b.title));

  grid.innerHTML = '';

  const groups = {};
  uniq.forEach((i) => {
    const k = (i.title[0] || '#').toUpperCase();
    (groups[k] ??= []).push(i);
  });

  Object.keys(groups).sort().forEach((letter) => {
    const h = document.createElement('div');
    h.className = 'letter-header';
    h.textContent = letter;
    grid.appendChild(h);

    groups[letter].forEach((i) => {
      const isGame = i.type === 'games';
      const isBook = i.type === 'books';
      const btnLabel = isGame ? 'Download' : isBook ? 'Read Now' : 'Play';
      const typeText = i.type.toUpperCase();
      const typeLine = i.meta ? `${typeText} | ${i.meta}` : typeText;

      const c = document.createElement('div');
      c.className = 'content-card';
      c.innerHTML = `
        <img class="card-image ${useLandscape ? 'is-landscape' : ''}" src="${i.pic}" alt="${i.title}">
        <div class="card-content">
          <h3 class="card-title">${i.title}</h3>
          <p class="card-description">${typeLine}</p>
          <button class="card-button">${btnLabel}</button>
        </div>
      `;

      const img = c.querySelector('img');
      img.onerror = () => fallback(img, i.title);

      c.querySelector('button').onclick = () => {
        sessionStorage.setItem('selectedContent', JSON.stringify(i));
        location.href = 'details.html';
      };

      grid.appendChild(c);
    });
  });
}

/* DETAILS */
let movieLink = '';
let gameLink = '';
let bookLink = '';

async function loadDetailsPage() {
  const poster = document.getElementById('detailsPoster');
  if (!poster) return;

  const raw = sessionStorage.getItem('selectedContent');
  if (!raw) return;

  const item = JSON.parse(raw);
  const id = norm(item.id);
  const title = norm(item.title);
  const type = lower(item.type);
  const pic = norm(item.pic);

  poster.src = pic;
  poster.onerror = () => fallback(poster, title);

  document.getElementById('detailsTitle').textContent = title;
  document.getElementById('detailsType').textContent = type.toUpperCase();

  const movieContainer = document.getElementById('movieContainer');
  const seasonsContainer = document.getElementById('seasonsContainer');
  const episodesContainer = document.getElementById('episodesContainer');

  const db = await fetchSheetData('DATABASE', 'A:G');

  movieContainer.style.display = 'none';
  seasonsContainer.style.display = 'none';
  episodesContainer.style.display = 'none';

  if (type === 'movie') {
    movieContainer.style.display = 'block';
    const btn = movieContainer.querySelector('button');
    if (btn) btn.textContent = '▶ PLAY NOW';

    const hit = db.find((r) => norm(r[1]) === id && lower(r[3]) === 'movie');
    movieLink = hit ? norm(hit[6]) : '';
    gameLink = '';
    bookLink = '';
  } else if (type === 'games') {
    movieContainer.style.display = 'block';
    const btn = movieContainer.querySelector('button');
    if (btn) btn.textContent = '⬇ DOWNLOAD';

    const hit = db.find((r) => norm(r[1]) === id && lower(r[3]) === 'games');
    gameLink = hit ? norm(hit[6]) : '';
    movieLink = '';
    bookLink = '';
  } else if (type === 'books') {
    movieContainer.style.display = 'block';
    const btn = movieContainer.querySelector('button');
    if (btn) btn.textContent = '📖 READ NOW';

    const hit = db.find((r) => norm(r[1]) === id && lower(r[3]) === 'books');
    bookLink = hit ? norm(hit[6]) : '';
    movieLink = '';
    gameLink = '';
  } else {
    seasonsContainer.style.display = 'block';

    const seasons = [...new Set(
      db
        .filter((r) => norm(r[1]) === id && lower(r[3]) === 'series')
        .map((r) => parseInt(norm(r[4]), 10))
        .filter((n) => !Number.isNaN(n) && n > 0)
    )].sort((a, b) => a - b);

    const sList = document.getElementById('seasonsList');
    sList.innerHTML = '';

    seasons.forEach((s) => {
      const b = document.createElement('button');
      b.textContent = `Season ${s}`;

      b.onclick = () => {
        document.querySelectorAll('#seasonsList button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');

        const eps = db
          .filter((r) => norm(r[1]) === id && parseInt(norm(r[4]), 10) === s)
          .map((r) => ({
            ep: parseInt(norm(r[5]), 10),
            link: norm(r[6])
          }))
          .filter((x) => !Number.isNaN(x.ep) && x.ep > 0 && x.link)
          .sort((a, b) => a.ep - b.ep);

        const eBox = document.getElementById('episodesContainer');
        const eList = document.getElementById('episodesList');

        eBox.style.display = 'block';
        eList.innerHTML = '';

        eps.forEach((e) => {
          const eb = document.createElement('button');
          eb.textContent = `Episode ${e.ep}`;
          eb.onclick = () => openPlayable(e.link);
          eList.appendChild(eb);
        });
      };

      sList.appendChild(b);
    });

    movieLink = '';
    gameLink = '';
    bookLink = '';
  }
}

function playMovie() {
  if (bookLink) return openPlayable(bookLink);
  if (gameLink) return openPlayable(gameLink);
  if (!movieLink) return alert('No movie link found.');
  openPlayable(movieLink);
}
window.playMovie = playMovie;

/* LIST */
async function loadListPage() {
  const grid = document.getElementById('listGrid');
  const title = document.getElementById('listTitle');
  if (!grid || !title) return;

  const chosen = sessionStorage.getItem('selectedListView');
  const selectedListImageMode = norm(sessionStorage.getItem('selectedListImageMode') || '1');
  const useLandscapeInListDetail = selectedListImageMode === '2';

  if (!chosen) {
    title.textContent = 'Browse Lists';

    const rows = await fetchSheetData('LIST', 'A:F');
    const all = rows
      .map((r) => ({
        id: norm(r[0]),
        title: norm(r[1]),
        desc: norm(r[2]),
        pic: norm(r[3]),
        group: norm(r[4]),
        imageMode: norm(r[5]) || '1'
      }))
      .filter((x) => x.id && x.title && x.group);

    grid.innerHTML = '';

    const grouped = {};
    all.forEach((x) => {
      const g = x.group.toUpperCase();
      (grouped[g] ??= []).push(x);
    });

    const preferredOrder = ['STREAMING', 'GAMING', 'READING', 'FOR KIDS ACCESS', 'MUSIC'];
    const groupNames = Object.keys(grouped).sort((a, b) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    groupNames.forEach((groupName) => {
      const items = grouped[groupName] || [];
      if (!items.length) return;

      const h = document.createElement('div');
      h.className = 'group-header';
      h.textContent = groupName;
      grid.appendChild(h);

      items.forEach((x) => {
        const c = document.createElement('div');
        c.className = 'category-card';
        c.innerHTML = `
          <img class="card-image" src="${x.pic}" alt="${x.title}">
          <div class="card-content">
            <h3 class="card-title">${x.title}</h3>
            <p class="card-description">${x.desc || ''}</p>
            <button class="card-button">CHECK LIST 👀</button>
          </div>
        `;

        const img = c.querySelector('img');
        img.onerror = () => fallback(img, x.title);

        c.querySelector('button').onclick = () => {
          sessionStorage.setItem('selectedListView', x.title);
          sessionStorage.setItem('selectedListImageMode', x.imageMode);
          location.reload();
        };

        grid.appendChild(c);
      });
    });

    return;
  }

  title.textContent = chosen;

  const rows = await fetchSheetData('ACCESS', 'A:F');
  const items = rows
    .map((r) => ({
      category: norm(r[0]),
      id: norm(r[1]),
      title: norm(r[2]),
      type: lower(r[3]),
      pic: norm(r[4]),
      meta: norm(r[5])
    }))
    .filter((x) => lower(x.category) === lower(chosen) && x.id && x.title);

  const uniq = [...new Map(items.map((i) => [i.id, i])).values()]
    .sort((a, b) => a.title.localeCompare(b.title));

  grid.innerHTML = '';

  const groups = {};
  uniq.forEach((i) => {
    const k = (i.title[0] || '#').toUpperCase();
    (groups[k] ??= []).push(i);
  });

  Object.keys(groups).sort().forEach((letter) => {
    const h = document.createElement('div');
    h.className = 'letter-header';
    h.textContent = letter;
    grid.appendChild(h);

    groups[letter].forEach((i) => {
      const typeText = i.type.toUpperCase();
      const typeLine = i.meta ? `${typeText} | ${i.meta}` : typeText;

      const c = document.createElement('div');
      c.className = 'content-card';
      c.innerHTML = `
        <img class="card-image ${useLandscapeInListDetail ? 'is-landscape' : ''}" src="${i.pic}" alt="${i.title}">
        <div class="card-content">
          <h3 class="card-title">${i.title}</h3>
          <p class="card-description">${typeLine}</p>
        </div>
      `;

      const img = c.querySelector('img');
      img.onerror = () => fallback(img, i.title);

      grid.appendChild(c);
    });
  });
}

/* TRIAL */
let trialVideoLink = '';

function openTrialModal(data) {
  const modal = document.getElementById('trialModal');
  if (!modal) return;

  const picEl = document.getElementById('trialPicture');
  const titleEl = document.getElementById('trialTitle');
  const descEl = document.getElementById('trialDescription');
  const warnEl = document.getElementById('trialWarning');
  const buyBtn = document.getElementById('buyTrialBtn');

  picEl.src = data.pic;
  picEl.onerror = () => fallback(picEl, data.title);

  titleEl.textContent = data.title;
  descEl.textContent = data.desc || '';
  warnEl.textContent = data.warn || 'Trial only.';

  buyBtn.href = data.buy || '#';

  trialVideoLink = data.link || '';
  modal.style.display = 'flex';
}

async function loadTrialPage() {
  const grid = document.getElementById('trialGrid');
  if (!grid) return;

  const rows = await fetchSheetData('TRIAL', 'A:G');
  grid.innerHTML = '';

  rows.forEach((r) => {
    const id = norm(r[0]);
    const title = norm(r[1]);
    const desc = norm(r[2]);
    const pic = norm(r[3]);
    const link = norm(r[4]);
    const warn = norm(r[5]);
    const buy = norm(r[6]);

    if (!id || !title || !pic) return;

    const c = document.createElement('div');
    c.className = 'trial-card';
    c.innerHTML = `
      <img class="trial-card-image" src="${pic}" alt="${title}">
      <div class="trial-card-content">
        <h3 class="card-title">${title}</h3>
        <p class="card-description">${desc}</p>
        <button class="card-button">Play</button>
      </div>
    `;

    const img = c.querySelector('img');
    img.onerror = () => fallback(img, title);

    c.querySelector('button').onclick = () => {
      openTrialModal({ title, desc, pic, link, warn, buy });
    };

    grid.appendChild(c);
  });
}

function playTrialVideo() {
  if (!trialVideoLink) return alert('No trial video link found.');
  openPlayable(trialVideoLink);
}

function closeTrialModal() {
  const modal = document.getElementById('trialModal');
  if (modal) modal.style.display = 'none';
  trialVideoLink = '';
}

window.playTrialVideo = playTrialVideo;
window.closeTrialModal = closeTrialModal;

/* BUY ACCESS */
let buyAccessLink = '';

function openBuyModal(data) {
  const modal = document.getElementById('buyModal');
  if (!modal) return;

  const picEl = document.getElementById('buyPicture');
  const titleEl = document.getElementById('buyTitle');
  const shortDescEl = document.getElementById('buyShortDescription');
  const fullDescEl = document.getElementById('buyFullDescription');
  const buyBtn = document.getElementById('buyAccessBtn');

  picEl.src = data.pic;
  picEl.onerror = () => fallback(picEl, data.title);

  titleEl.textContent = data.title;
  shortDescEl.textContent = data.desc || '';
  fullDescEl.textContent = data.fullDesc || '';

  buyAccessLink = data.link || '';
  buyBtn.href = buyAccessLink || '#';

  modal.style.display = 'flex';
}

async function loadBuyPage() {
  const grid = document.getElementById('buyGrid');
  if (!grid) return;

  const rows = await fetchSheetData('BUY', 'A:G');
  grid.innerHTML = '';

  const all = rows
    .map((r) => ({
      id: norm(r[0]),
      title: norm(r[1]),
      desc: norm(r[2]),
      pic: norm(r[3]),
      group: norm(r[4]),
      fullDesc: norm(r[5]),
      link: norm(r[6])
    }))
    .filter((x) => x.id && x.title && x.pic && x.group);

  const grouped = {};
  all.forEach((x) => {
    const g = x.group.toUpperCase();
    (grouped[g] ??= []).push(x);
  });

  const preferredOrder = ['STREAMING', 'GAMING', 'READING', 'FOR KIDS ACCESS', 'MUSIC'];
  const groupNames = Object.keys(grouped).sort((a, b) => {
    const ai = preferredOrder.indexOf(a);
    const bi = preferredOrder.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  groupNames.forEach((groupName) => {
    const items = grouped[groupName] || [];
    if (!items.length) return;

    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = groupName;
    grid.appendChild(header);

    items.forEach((x) => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.innerHTML = `
        <img class="card-image" src="${x.pic}" alt="${x.title}" loading="lazy">
        <div class="card-content">
          <h3 class="card-title">${x.title}</h3>
          <p class="card-description">${x.desc || ''}</p>
          <button class="card-button">BUY ACCESS</button>
        </div>
      `;

      const img = card.querySelector('img');
      img.onerror = () => fallback(img, x.title);

      card.querySelector('button').onclick = () => {
        openBuyModal(x);
      };

      grid.appendChild(card);
    });
  });
}

function closeBuyModal() {
  const modal = document.getElementById('buyModal');
  if (modal) modal.style.display = 'none';
  buyAccessLink = '';
}

window.closeBuyModal = closeBuyModal;

/* MODAL BACKDROP CLOSE */
window.addEventListener('click', (e) => {
  const trialModal = document.getElementById('trialModal');
  if (trialModal && e.target === trialModal) closeTrialModal();

  const buyModal = document.getElementById('buyModal');
  if (buyModal && e.target === buyModal) closeBuyModal();
});

/* BOOT - only one boot section */
document.addEventListener('DOMContentLoaded', () => {
  bindListNavReset();
  initPinUI();

  if (document.getElementById('categoriesGrid')) loadCategories();
  if (document.getElementById('contentGrid')) loadCategoryPage();
  if (document.getElementById('detailsPoster')) loadDetailsPage();
  if (document.getElementById('listGrid')) loadListPage();
  if (document.getElementById('trialGrid')) loadTrialPage();
  if (document.getElementById('buyGrid')) loadBuyPage();
});
