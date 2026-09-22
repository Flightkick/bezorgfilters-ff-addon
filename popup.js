'use strict';

const fields = [
  { key: 'enabled', el: document.getElementById('enabled'), type: 'checkbox' },
  { key: 'freeDeliveryOnly', el: document.getElementById('freeDeliveryOnly'), type: 'checkbox' },
  { key: 'deliveryFeeMax', el: document.getElementById('deliveryFeeMax'), type: 'number' },
  { key: 'minOrderMax', el: document.getElementById('minOrderMax'), type: 'number' },
  { key: 'showPanel', el: document.getElementById('showPanel'), type: 'checkbox' }
];

const statusEl = document.getElementById('status');
let settings = TBZ.DEFAULT_SETTINGS;

function toInputValue(value) {
  return value > 0 ? String(value) : '';
}

function fromInputValue(input) {
  const n = parseFloat(input);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function render() {
  for (const f of fields) {
    if (f.type === 'checkbox') {
      f.el.checked = !!settings[f.key];
    } else {
      f.el.value = toInputValue(settings[f.key]);
    }
  }
  statusEl.textContent = TBZ.settingsSummary(settings);
}

function persist(patch) {
  settings = Object.assign({}, settings, patch);
  browser.storage.local.set({ settings });
  statusEl.textContent = TBZ.settingsSummary(settings);
}

for (const f of fields) {
  if (f.type === 'checkbox') {
    f.el.addEventListener('change', () => persist({ [f.key]: f.el.checked }));
  } else {
    f.el.addEventListener('change', () => persist({ [f.key]: fromInputValue(f.el.value) }));
  }
}

document.getElementById('reset').addEventListener('click', () => {
  settings = TBZ.DEFAULT_SETTINGS;
  browser.storage.local.set({ settings });
  render();
});

browser.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = TBZ.normalizeSettings(changes.settings.newValue);
    render();
  }
});

browser.storage.local.get('settings').then((stored) => {
  settings = TBZ.normalizeSettings(stored && stored.settings);
  render();
});
