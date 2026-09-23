'use strict';

const CARD_SELECTOR = '[data-qa="restaurant-card"], [data-testid^="restaurant-item"]';

const FILTER_LIST_SELECTOR = 'search[data-qa="sidebar"] ul[data-qa="filter"]';

const PANEL_ROOT_SELECTOR = '[data-tbz-panel]';

const CUISINE_FILTER_SELECTOR = '[data-qa="cuisine-filter"]';

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
let panel = null;

function scheduleScan() {
  if (pendingScan) return;
  pendingScan = setTimeout(() => {
    pendingScan = null;
    scan();
  }, 150);
}

function scan() {
  if (!state.settings.showPanel) {
    removeAllPanels();
  } else {
    ensurePanels();
  }
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
  if (!panel) return;
  const el = panel.box.querySelector('.tbz-count');
  if (el) el.textContent = state.counts.visible + ' van ' + state.counts.total;
}

function buildPanelBox() {
  const box = document.createElement('div');
  box.className = 'tbz-panel';

  const header = document.createElement('div');
  header.className = 'tbz-panel-header';

  const title = document.createElement('strong');
  title.className = 'tbz-title';
  title.textContent = 'BezorgFilters';
  header.appendChild(title);

  const count = document.createElement('span');
  count.className = 'tbz-count';
  header.appendChild(count);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'tbz-toggle-btn';
  toggleBtn.setAttribute('aria-pressed', 'false');
  toggleBtn.title = 'In-/uitklappen';
  toggleBtn.textContent = '\u25bc';
  header.appendChild(toggleBtn);

  box.appendChild(header);

  const body = document.createElement('div');
  body.className = 'tbz-panel-body';

  const enabledRow = document.createElement('label');
  enabledRow.className = 'tbz-row';
  const enabledInput = document.createElement('input');
  enabledInput.type = 'checkbox';
  enabledInput.className = 'tbz-enabled';
  enabledRow.appendChild(enabledInput);
  enabledRow.appendChild(document.createTextNode(' Filtering actief'));
  body.appendChild(enabledRow);

  const feeRow = document.createElement('div');
  feeRow.className = 'tbz-row tbz-range';
  const feeLabel = document.createElement('span');
  feeLabel.className = 'tbz-label';
  feeLabel.textContent = 'Bezorgkosten (\u20ac), max';
  feeRow.appendChild(feeLabel);
  const feeMax = document.createElement('input');
  feeMax.type = 'number';
  feeMax.className = 'tbz-fee-max';
  feeMax.min = '0';
  feeMax.step = '0.5';
  feeMax.placeholder = '0 = gratis';
  feeRow.appendChild(feeMax);
  body.appendChild(feeRow);

  const minOrderRow = document.createElement('div');
  minOrderRow.className = 'tbz-row tbz-range';
  const minOrderLabel = document.createElement('span');
  minOrderLabel.className = 'tbz-label';
  minOrderLabel.textContent = 'Min. bestelling (\u20ac), max';
  minOrderRow.appendChild(minOrderLabel);
  const minOrderMax = document.createElement('input');
  minOrderMax.type = 'number';
  minOrderMax.className = 'tbz-minorder';
  minOrderMax.min = '0';
  minOrderMax.step = '0.5';
  minOrderMax.placeholder = 'max';
  minOrderRow.appendChild(minOrderMax);
  body.appendChild(minOrderRow);

  box.appendChild(body);

  const set = (key, value) => {
    state.settings = Object.assign({}, state.settings, { [key]: value });
    browser.storage.local.set({ settings: state.settings });
    scheduleScan();
  };

  box.querySelector('.tbz-enabled').addEventListener('change', (e) => set('enabled', e.target.checked));
  box.querySelector('.tbz-fee-max').addEventListener('change', (e) => set('deliveryFeeMax', parseNum(e.target.value)));
  box.querySelector('.tbz-minorder').addEventListener('change', (e) => set('minOrderMax', parseNum(e.target.value)));

  box.querySelector('.tbz-toggle-btn').addEventListener('click', () => {
    const collapsed = box.classList.toggle('tbz-collapsed');
    box.querySelector('.tbz-toggle-btn').setAttribute('aria-pressed', String(!collapsed));
  });

  return box;
}

function isElementVisible(el) {
  if (!el || !el.isConnected) return false;
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkVisibilityCSS: true });
  }
  const win = el.ownerDocument.defaultView;
  let node = el;
  while (node && node.nodeType === win.Node.ELEMENT_NODE) {
    if (node.hasAttribute('hidden')) return false;
    if (win.getComputedStyle(node).display === 'none') return false;
    node = node.parentElement;
  }
  return true;
}

function pickPanelTarget() {
  for (const list of document.querySelectorAll(FILTER_LIST_SELECTOR)) {
    if (isElementVisible(list)) return { kind: 'list', mount: list };
  }
  const cuisine = document.querySelector(CUISINE_FILTER_SELECTOR);
  if (cuisine && isElementVisible(cuisine)) return { kind: 'inline', mount: cuisine };
  return null;
}

function removeAllPanels() {
  panel = null;
  document.querySelectorAll(PANEL_ROOT_SELECTOR).forEach((el) => el.remove());
}

function ensurePanels() {
  if (!document.querySelector(CARD_SELECTOR)) return;
  const target = pickPanelTarget();

  if (panel && (!panel.root.isConnected || !target || panel.kind !== target.kind || panel.mount !== target.mount)) {
    panel = null;
  }

  document.querySelectorAll(PANEL_ROOT_SELECTOR).forEach((el) => {
    if (!panel || el !== panel.root) el.remove();
  });

  if (!target || panel) return;

  const root = document.createElement(target.kind === 'list' ? 'li' : 'div');
  root.className = 'tbz-panel-root';
  root.dataset.tbzPanel = target.kind;
  const box = buildPanelBox();
  if (target.kind === 'inline') box.classList.add('tbz-panel-inline');
  root.appendChild(box);
  if (target.kind === 'inline') {
    target.mount.insertAdjacentElement('afterend', root);
  } else {
    target.mount.appendChild(root);
  }
  panel = { root, box, mount: target.mount, kind: target.kind };
  syncPanel();
}

function syncPanel() {
  if (!panel) return;
  const s = state.settings;
  panel.box.querySelector('.tbz-enabled').checked = s.enabled;
  panel.box.querySelector('.tbz-fee-max').value = s.deliveryFeeMax !== null ? s.deliveryFeeMax : '';
  panel.box.querySelector('.tbz-minorder').value = s.minOrderMax !== null ? s.minOrderMax : '';
  updateCounts();
}

function parseNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
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
    ensurePanels();
    syncPanel();
    scheduleScan();
  });

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('resize', scheduleScan);

  browser.storage.onChanged.addListener(onSettingsChanged);
}

start();
