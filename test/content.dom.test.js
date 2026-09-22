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
    '\nwindow.__tbzTestBridge.tbz = { applyFilters, extractCardData, ensurePanel, scan, state };'
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
  const main = document.querySelector('main');
  tbz.ensurePanel();
  const panelV1 = document.getElementById('tbz-panel');
  assert.ok(panelV1, 'panel created');
  assert.ok(main.contains(panelV1), 'panel inside main');
  panelV1.remove();
  assert.strictEqual(document.getElementById('tbz-panel'), null, 'site wiped the panel');
  tbz.scan();
  const panelV2 = document.getElementById('tbz-panel');
  assert.ok(panelV2, 'panel recreated after being removed');
  assert.notStrictEqual(panelV2, panelV1, 'fresh panel instance');
  assert.strictEqual(panelV2.querySelector('#tbz-fee-max').value, '', 'recreated panel synced from settings');

  console.log('DOM integration tests passed.');
}

run();
