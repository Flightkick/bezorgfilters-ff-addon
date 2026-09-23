'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const TBZ = require(path.join(root, 'lib/filters.js'));
const html = fs.readFileSync(path.join(root, 'test/fixtures/restaurant-list.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://www.thuisbezorgd.nl/en/order/leiden',
  pretendToBeVisual: true,
  runScripts: 'dangerously'
});
const { window } = dom;

window.eval('window.__tbzTestBridge = {};');
const bridge = window.__tbzTestBridge;

function injectScript(src) {
  const script = window.document.createElement('script');
  script.textContent = src;
  window.document.body.appendChild(script);
  script.remove();
}

injectScript(fs.readFileSync(path.join(root, 'lib/filters.js'), 'utf8'));
injectScript(
  fs.readFileSync(path.join(root, 'content.js'), 'utf8').replace(
    /\nstart\(\);\s*$/,
    '\nwindow.__tbzTestBridge.tbz = { applyFilters, extractCardData, ensurePanels, scan, state, panel: () => panel };'
  )
);

const tbz = bridge.tbz;
const document = window.document;

const CARD_SELECTOR = '[data-qa="restaurant-card"], [data-testid^="restaurant-item"]';
const FREE_DELIVERY_TEXT_RE = /(gratis|free)\s+(bezorg|delivery)/i;

function extractCardData(el) {
  const card = { name: '', deliveryFee: null, minOrder: null, freeDelivery: false };
  const nameEl = el.querySelector('[data-qa="restaurant-info-name"], [data-testid="restaurant-name"], h2, h3');
  if (nameEl) card.name = nameEl.textContent.trim();
  const feeTexts = [];
  el.querySelectorAll('[data-qa="restaurant-delivery-fee"], [data-testid*="delivery-fee"]').forEach((n) => feeTexts.push(n.textContent));
  const minTexts = [];
  el.querySelectorAll('[data-qa="restaurant-mov"], [data-testid*="minimum-order"]').forEach((n) => minTexts.push(n.textContent));
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

function cards() {
  return Array.from(document.querySelectorAll(CARD_SELECTOR)).map(extractCardData);
}

function hiddenCount() {
  return document.querySelectorAll('.tbz-hidden').length;
}

function run() {
  const all = cards();
  assert.strictEqual(all.length, 5, 'five cards found with data-qa selector');

  assert.strictEqual(all[0].name, 'Gochu Gang - Korean Fried Chicken - Leiden');
  assert.strictEqual(all[0].deliveryFee, 2.5, '€2,50 delivery parsed');
  assert.strictEqual(all[0].minOrder, 15, 'Min. €15,00 parsed');
  assert.strictEqual(all[0].freeDelivery, false);

  assert.strictEqual(all[1].freeDelivery, true, 'Free delivery tag detected');
  assert.strictEqual(all[1].deliveryFee, 0);
  assert.strictEqual(all[1].minOrder, 50);

  assert.strictEqual(all[2].deliveryFee, 5, '€5 delivery parsed');

  assert.strictEqual(all[3].freeDelivery, true, 'Free delivery available tag detected');
  assert.strictEqual(all[3].deliveryFee, 0);

  assert.strictEqual(all[4].deliveryFee, 9.99, '€9,99 delivery parsed');
  assert.strictEqual(all[4].minOrder, 35);

  const names = Array.from(document.querySelectorAll('[data-qa="restaurant-info-name"]')).map((n) => n.textContent);
  assert.ok(names.includes("Meryem's"));

  const apply = () => {
    const els = Array.from(document.querySelectorAll(CARD_SELECTOR));
    tbz.applyFilters(els);
    return els;
  };

  tbz.applyFilters(Array.from(document.querySelectorAll(CARD_SELECTOR)));
  assert.strictEqual(document.querySelectorAll('.tbz-dimmed').length, 0, 'no filters set: nothing dimmed');

  tbz.state.settings = TBZ.normalizeSettings({ deliveryFeeMax: 3, enabled: true });
  const els = apply();
  const dimmedNames = Array.from(document.querySelectorAll('[data-tbz-filtered]'))
    .map((el) => el.querySelector('[data-qa="restaurant-info-name"]').textContent);
  assert.deepStrictEqual(dimmedNames, ['Fat Phills Leiden', "Meryem's"], 'fee > 3 dimmed');
  for (const el of els) {
    if (el.hasAttribute('data-tbz-filtered')) {
      assert.ok(el.classList.contains('tbz-dimmed'), 'card dimmed');
      assert.ok(!el.classList.contains('tbz-hidden'), 'never hidden');
    } else {
      assert.ok(!el.classList.contains('tbz-dimmed'), 'card not dimmed');
    }
  }

  tbz.state.settings = TBZ.normalizeSettings({ deliveryFeeMax: 0 });
  apply();
  const freeDimmed = Array.from(document.querySelectorAll('[data-tbz-filtered]'))
    .map((el) => el.querySelector('[data-qa="restaurant-info-name"]').textContent);
  assert.strictEqual(freeDimmed.length, 3, 'non-free-delivery dimmed');

  tbz.state.settings = TBZ.normalizeSettings({ minOrderMax: 20 });
  apply();
  const minDimmed = Array.from(document.querySelectorAll('[data-tbz-filtered]'))
    .map((el) => el.querySelector('[data-qa="restaurant-info-name"]').textContent);
  assert.deepStrictEqual(minDimmed, ['Papito', 'Fat Phills Leiden', "Meryem's"], 'min order > 20 dimmed');

  tbz.state.settings = TBZ.normalizeSettings({ showPanel: true });
  const filterList = document.querySelector('search[data-qa="sidebar"] ul[data-qa="filter"]');
  const cuisine = document.querySelector('[data-qa="cuisine-filter"]');
  tbz.ensurePanels();
  assert.strictEqual(document.querySelectorAll('.tbz-panel').length, 1, 'ensurePanels creates a single panel');
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('.tbz-panel').length, 1, 'exactly one panel after scan');
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'exactly one panel root in the DOM');
  let listPanel = document.querySelector('li[data-tbz-panel="list"]');
  assert.ok(listPanel, 'panel rendered as a list item when the sidebar is visible');
  assert.strictEqual(listPanel.tagName, 'LI', 'sidebar panel rendered as a list item');
  assert.ok(filterList.contains(listPanel), 'sidebar panel inside the filter list');
  assert.strictEqual(document.querySelector('div[data-tbz-panel="inline"]'), null, 'no inline panel while the sidebar is visible');

  tbz.ensurePanels();
  tbz.ensurePanels();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'repeated ensurePanels does not duplicate the panel');

  const sidebarSearch = document.querySelector('search[data-qa="sidebar"]');
  sidebarSearch.style.display = 'none';
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'still exactly one panel after hiding the sidebar');
  let inlinePanel = document.querySelector('div[data-tbz-panel="inline"]');
  assert.ok(inlinePanel, 'panel moves inline once the sidebar is hidden');
  assert.strictEqual(inlinePanel.tagName, 'DIV', 'inline panel rendered as a div');
  assert.strictEqual(cuisine.nextElementSibling, inlinePanel, 'inline panel directly below the cuisine row');
  assert.strictEqual(document.querySelector('li[data-tbz-panel="list"]'), null, 'no leftover sidebar panel after moving inline');

  sidebarSearch.style.display = '';
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'still exactly one panel after restoring the sidebar');
  listPanel = document.querySelector('li[data-tbz-panel="list"]');
  assert.ok(listPanel, 'panel moved back into the sidebar');
  assert.ok(filterList.contains(listPanel), 'sidebar panel back in the filter list');
  assert.strictEqual(document.querySelector('div[data-tbz-panel="inline"]'), null, 'inline panel removed when the sidebar returns');

  assert.strictEqual(document.querySelectorAll('.tbz-panel .tbz-fee-max').length, 1, 'no duplicate element ids across panels');
  assert.ok(!document.querySelector('[id^="tbz-"][id$="-fee-max"]'), 'internal ids replaced by classes');

  listPanel.remove();
  tbz.scan();
  const listPanelV2 = document.querySelector('li[data-tbz-panel="list"]');
  assert.ok(listPanelV2 && listPanelV2 !== listPanel, 'sidebar panel recreated after being wiped');
  assert.ok(filterList.contains(listPanelV2), 'recreated sidebar panel back in the filter list');
  assert.strictEqual(listPanelV2.querySelector('.tbz-fee-max').value, '', 'recreated panel synced from settings');

  const modalSheet = document.createElement('div');
  modalSheet.innerHTML = '<search data-qa="sidebar"><ul role="list" data-qa="filter"></ul></search>';
  document.body.appendChild(modalSheet);
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'still exactly one panel with the modal open');
  assert.strictEqual(tbz.panel().root, listPanelV2, 'visible sidebar keeps the panel, modal sheet does not add a second');
  assert.ok(!modalSheet.querySelector('li[data-tbz-panel="list"]'), 'no panel duplicated into the mobile filter modal while the sidebar is visible');

  sidebarSearch.style.display = 'none';
  tbz.scan();
  const modalPanel = modalSheet.querySelector('li[data-tbz-panel="list"]');
  assert.ok(modalSheet.querySelector('li[data-tbz-panel="list"]'), 'mobile filter modal receives the panel when the sidebar is hidden');
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'still exactly one panel after switching to the modal');
  assert.ok(!document.querySelector('div[data-tbz-panel="inline"]'), 'inline panel not used while the modal list is visible');

  modalSheet.remove();
  sidebarSearch.style.display = '';
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'still exactly one panel after the modal closes');
  assert.ok(filterList.contains(document.querySelector('li[data-tbz-panel="list"]')), 'sidebar panel back');
  assert.strictEqual(document.querySelector('div[data-tbz-panel="inline"]'), null, 'inline panel gone');

  document.querySelectorAll('[data-tbz-panel]').forEach((el) => el.remove());
  document.body.insertAdjacentHTML('beforeend', '<div data-tbz-panel="inline" class="tbz-panel-root"></div>');
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'stray panels from older runs are cleaned up');
  assert.ok(filterList.contains(document.querySelector('li[data-tbz-panel="list"]')), 'single tracked panel remains');

  tbz.state.settings = TBZ.normalizeSettings({ showPanel: false });
  tbz.scan();
  assert.strictEqual(tbz.panel(), null, 'panel reference dropped when showPanel is off');
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 0, 'all panels removed live when showPanel is off');
  assert.strictEqual(document.querySelector('li[data-tbz-panel="list"]'), null, 'sidebar panel gone');
  assert.strictEqual(document.querySelector('div[data-tbz-panel="inline"]'), null, 'inline panel gone');

  tbz.state.settings = TBZ.normalizeSettings({ showPanel: true });
  tbz.scan();
  assert.strictEqual(document.querySelectorAll('[data-tbz-panel]').length, 1, 'panel re-created live when showPanel is on again');
  assert.ok(filterList.contains(document.querySelector('li[data-tbz-panel="list"]')), 'sidebar panel back');
  assert.strictEqual(document.querySelector('div[data-tbz-panel="inline"]'), null, 'only the sidebar panel exists');

  console.log('DOM integration tests passed.');
}

run();
