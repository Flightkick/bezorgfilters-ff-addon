'use strict';

const CARD_SELECTOR = '[data-qa="restaurant-card"], [data-testid^="restaurant-item"]';

const FILTER_LIST_SELECTOR = 'search[data-qa="sidebar"] ul[data-qa="filter"]';

const NAME_SELECTOR = '[data-qa="restaurant-info-name"], [data-testid="restaurant-name"], h2, h3';

const FEE_SELECTOR = '[data-qa="restaurant-delivery-fee"], [data-testid*="delivery-fee"]';

const MOV_SELECTOR = '[data-qa="restaurant-mov"], [data-testid*="minimum-order"]';

const FREE_DELIVERY_TEXT_RE = /(gratis|free)\s+(bezorg|delivery)/i;

function extractCardData(el) {
  const card = {
    name: '',
    deliveryFee: null,
    minOrder: null,
    freeDelivery: false
  };

  const nameEl = el.querySelector(NAME_SELECTOR);
  if (nameEl) card.name = nameEl.textContent.trim();

  const feeTexts = [];
  el.querySelectorAll(FEE_SELECTOR).forEach((n) => feeTexts.push(n.textContent));

  const minTexts = [];
  el.querySelectorAll(MOV_SELECTOR).forEach((n) => minTexts.push(n.textContent));

  for (const text of feeTexts) {
    if (FREE_DELIVERY_TEXT_RE.test(text)) {
      card.freeDelivery = true;
      card.deliveryFee = 0;
      break;
    }
  }

  if (card.deliveryFee === null && feeTexts.length > 0) {
    const price = TBZ.parsePrice(feeTexts[0]);
    if (price !== null) card.deliveryFee = price;
  }

  if (feeTexts.length === 0 && FREE_DELIVERY_TEXT_RE.test(el.textContent || '')) {
    card.freeDelivery = true;
    card.deliveryFee = 0;
  }

  if (minTexts.length > 0) {
    const price = TBZ.parsePrice(minTexts[0]);
    if (price !== null) card.minOrder = price;
  }

  return card;
}

const state = {
  settings: TBZ.DEFAULT_SETTINGS,
  counts: { visible: 0, total: 0 }
};

let pendingScan = null;
let panelEl = null;

function scheduleScan() {
  if (pendingScan) return;
  pendingScan = setTimeout(() => {
    pendingScan = null;
    scan();
  }, 150);
}

function scan() {
  if (panelEl && !panelEl.isConnected) {
    panelEl = null;
  }
  if (panelEl && !state.settings.showPanel) {
    panelEl.remove();
    panelEl = null;
  }
  ensurePanel();
  const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
  applyFilters(cards);
}

function applyFilters(cards) {
  let visible = 0;

  for (const el of cards) {
    const card = extractCardData(el);
    const show = TBZ.matchesFilters(card, state.settings);
    if (show) {
      el.classList.remove('tbz-dimmed');
      el.removeAttribute('data-tbz-filtered');
      visible++;
    } else {
      el.classList.add('tbz-dimmed');
      el.setAttribute('data-tbz-filtered', '1');
    }
  }

  state.counts.total = cards.length;
  state.counts.visible = visible;
  updateCounts();
}

function updateCounts() {
  if (!panelEl) return;
  const el = panelEl.querySelector('#tbz-count');
  if (!el) return;
  el.textContent = state.counts.visible + ' van ' + state.counts.total;
}

function ensurePanel() {
  if (panelEl || !state.settings.showPanel) return;
  if (!document.querySelector(CARD_SELECTOR)) return;

  const list = document.querySelector(FILTER_LIST_SELECTOR);
  if (!list) return;
  panelEl = document.createElement('li');
  panelEl.id = 'tbz-panel';
  const box = document.createElement('div');
  box.className = 'tbz-panel';
  box.innerHTML = [
    '<div class="tbz-panel-header">',
    '  <strong class="tbz-title">BezorgFilters</strong>',
    '  <span class="tbz-count" id="tbz-count"></span>',
    '  <button type="button" class="tbz-toggle-btn" id="tbz-toggle" aria-pressed="false" title="In-/uitklappen">▼</button>',
    '</div>',
    '<div class="tbz-panel-body">',
    '  <label class="tbz-row"><input type="checkbox" id="tbz-enabled"> Filtering actief</label>',
    '  <div class="tbz-row tbz-range">',
    '    <span class="tbz-label">Bezorgkosten (€), max</span>',
    '    <input type="number" id="tbz-fee-max" min="0" step="0.5" placeholder="0 = gratis">',
    '  </div>',
    '  <div class="tbz-row tbz-range">',
    '    <span class="tbz-label">Min. bestelling (€), max</span>',
    '    <input type="number" id="tbz-minorder" min="0" step="0.5" placeholder="max">',
    '  </div>',
    '</div>'
  ].join('\n');
  panelEl.appendChild(box);
  list.appendChild(panelEl);

  const set = (key, value) => {
    state.settings = Object.assign({}, state.settings, { [key]: value });
    browser.storage.local.set({ settings: state.settings });
    scheduleScan();
  };

  panelEl.querySelector('#tbz-enabled').addEventListener('change', (e) => set('enabled', e.target.checked));
  panelEl.querySelector('#tbz-fee-max').addEventListener('change', (e) => set('deliveryFeeMax', parseNum(e.target.value)));
  panelEl.querySelector('#tbz-minorder').addEventListener('change', (e) => set('minOrderMax', parseNum(e.target.value)));

  box.querySelector('#tbz-toggle').addEventListener('click', () => {
    const collapsed = box.classList.toggle('tbz-collapsed');
    box.querySelector('#tbz-toggle').setAttribute('aria-pressed', String(!collapsed));
  });

  syncPanel();
}

function parseNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function syncPanel() {
  if (!panelEl) return;
  const s = state.settings;
  panelEl.querySelector('#tbz-enabled').checked = s.enabled;
  panelEl.querySelector('#tbz-fee-max').value = s.deliveryFeeMax !== null ? s.deliveryFeeMax : '';
  panelEl.querySelector('#tbz-minorder').value = s.minOrderMax !== null ? s.minOrderMax : '';
  updateCounts();
}

function onSettingsChanged(changes) {
  if (changes.settings) {
    state.settings = TBZ.normalizeSettings(changes.settings.newValue);
    syncPanel();
    scheduleScan();
  }
}

function start() {
  browser.storage.local.get('settings').then((stored) => {
    state.settings = TBZ.normalizeSettings(stored && stored.settings);
    ensurePanel();
    syncPanel();
    scheduleScan();
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  browser.storage.onChanged.addListener(onSettingsChanged);
}

start();
