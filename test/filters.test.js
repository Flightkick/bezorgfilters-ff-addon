'use strict';

const assert = require('assert');
const TBZ = require('../lib/filters.js');

function run() {
  testParsePrice();
  testNormalizeSettings();
  testMatchesFilters();
  testSummaryAndActive();
  console.log('All tests passed.');
}

function testParsePrice() {
  const cases = [
    ['€ 0,00', 0],
    ['€0,00', 0],
    ['€ 2,50', 2.5],
    ['2,50', 2.5],
    ['€ 3.49', 3.49],
    ['3.49', 3.49],
    ['Gratis bezorging', 0],
    ['Free delivery', 0],
    ['gratis', 0],
    ['Bezorging', null],
    ['€ 12', 12],
    ['€ 1.234,56', 1234.56],
    ['€ 1,234.56', 1234.56],
    ['€ 1.234', 1234],
    ['', null],
    ['abc', null],
    [null, null],
    [undefined, null],
    [-1, null],
    [3.5, 3.5]
  ];
  for (const [input, expected] of cases) {
    const result = TBZ.parsePrice(input);
    assert.strictEqual(
      result,
      expected,
      'parsePrice(' + JSON.stringify(input) + ') => ' + result + ', expected ' + expected
    );
  }
}

function testNormalizeSettings() {
  const s = TBZ.normalizeSettings(undefined);
  assert.deepStrictEqual(s, {
    enabled: true,
    freeDeliveryOnly: false,
    deliveryFeeMin: 0,
    deliveryFeeMax: 0,
    minOrderMax: 0,
    mode: 'hide',
    showPanel: true
  });

  const t = TBZ.normalizeSettings({ deliveryFeeMin: 2, mode: 'dim', extra: true, deliveryFeeMax: -5 });
  assert.strictEqual(t.deliveryFeeMin, 2);
  assert.strictEqual(t.mode, 'dim');
  assert.strictEqual(t.deliveryFeeMax, 0);
  assert.strictEqual(t.extra, undefined);

  const u = TBZ.normalizeSettings(null);
  assert.strictEqual(u.enabled, true);
}

function testMatchesFilters() {
  const card = { deliveryFee: 2.5, minOrder: 15, freeDelivery: false };
  const free = { deliveryFee: 0, minOrder: 10, freeDelivery: true };
  const unknown = { deliveryFee: null, minOrder: null, freeDelivery: false };

  assert.strictEqual(TBZ.matchesFilters(card, {}), true, 'default settings show everything');
  assert.strictEqual(TBZ.matchesFilters(card, { enabled: false, deliveryFeeMax: 1 }), true, 'disabled shows all');
  assert.strictEqual(TBZ.matchesFilters(card, { deliveryFeeMax: 3 }), true);
  assert.strictEqual(TBZ.matchesFilters(card, { deliveryFeeMax: 2 }), false);
  assert.strictEqual(TBZ.matchesFilters(free, { freeDeliveryOnly: true }), true);
  assert.strictEqual(TBZ.matchesFilters(card, { freeDeliveryOnly: true }), false);
  assert.strictEqual(TBZ.matchesFilters(card, { deliveryFeeMin: 2 }), true);
  assert.strictEqual(TBZ.matchesFilters(card, { deliveryFeeMin: 3 }), false);
  assert.strictEqual(TBZ.matchesFilters(card, { minOrderMax: 15 }), true);
  assert.strictEqual(TBZ.matchesFilters(card, { minOrderMax: 10 }), false);
  assert.strictEqual(TBZ.matchesFilters(unknown, { deliveryFeeMax: 1 }), true, 'unknown fee passes max filter');
  assert.strictEqual(TBZ.matchesFilters(unknown, { deliveryFeeMin: 1 }), true, 'unknown fee passes min filter');
  assert.strictEqual(
    TBZ.matchesFilters(free, { freeDeliveryOnly: true, minOrderMax: 15 }),
    true,
    'combined filters'
  );
  assert.strictEqual(
    TBZ.matchesFilters(card, { deliveryFeeMax: 3, minOrderMax: 10 }),
    false,
    'combined filters exclude'
  );
}

function testSummaryAndActive() {
  assert.strictEqual(TBZ.hasActiveFilters({}), false);
  assert.strictEqual(TBZ.hasActiveFilters({ deliveryFeeMax: 3 }), true);
  assert.strictEqual(TBZ.hasActiveFilters({ freeDeliveryOnly: true }), true);
  assert.strictEqual(TBZ.settingsSummary({}), 'geen filters actief');
  assert.ok(TBZ.settingsSummary({ deliveryFeeMax: 3 }).includes('€3,00'));
  assert.strictEqual(TBZ.formatPrice(2.5), '2,50');
}

run();
