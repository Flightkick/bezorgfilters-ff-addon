(function (global) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    freeDeliveryOnly: false,
    deliveryFeeMax: 0,
    minOrderMax: 0,
    showPanel: true
  });

  function normalizeSettings(raw) {
    const out = Object.assign({}, DEFAULT_SETTINGS);
    if (!raw || typeof raw !== 'object') return out;
    if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
    if (typeof raw.freeDeliveryOnly === 'boolean') out.freeDeliveryOnly = raw.freeDeliveryOnly;
    if (isNonNegativeNumber(raw.deliveryFeeMax)) out.deliveryFeeMax = raw.deliveryFeeMax;
    if (isNonNegativeNumber(raw.minOrderMax)) out.minOrderMax = raw.minOrderMax;
    if (typeof raw.showPanel === 'boolean') out.showPanel = raw.showPanel;
    return out;
  }

  function isNonNegativeNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function parsePrice(input) {
    if (typeof input === 'number') {
      return Number.isFinite(input) && input >= 0 ? input : null;
    }
    if (typeof input !== 'string') return null;
    const text = input.trim().toLowerCase();
    if (!text) return null;
    if (/^(gratis|free)$/.test(text)) return 0;
    const match = text.match(/(\d[\d.,]*)/);
    if (!match) return /gratis|free/.test(text) ? 0 : null;
    return parseNumberString(match[1]);
  }

  function parseNumberString(digits) {
    let s = digits.replace(/\s/g, '');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastComma > lastDot) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      s = s.replace(/,/g, '.');
    } else if (hasDot) {
      const parts = s.split('.');
      if (parts.length === 2 && parts[1].length === 3 && parts[0].length > 0) {
        s = parts.join('');
      }
    }
    s = s.replace(/\.$/, '');
    const value = parseFloat(s);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const CARD_MATCHES = {
    all: () => true
  };

  function matchesFilters(card, settings) {
    const s = normalizeSettings(settings);
    if (!s.enabled) return true;
    if (s.freeDeliveryOnly && !isFreeDelivery(card)) return false;
    if (s.deliveryFeeMax > 0 && !withinMax(card.deliveryFee, s.deliveryFeeMax)) return false;
    if (s.minOrderMax > 0 && !withinMax(card.minOrder, s.minOrderMax)) return false;
    return true;
  }

  function isFreeDelivery(card) {
    return card.freeDelivery === true || card.deliveryFee === 0;
  }

  function withinMax(value, max) {
    if (value === null || value === undefined) return true;
    return value <= max;
  }

  function hasActiveFilters(settings) {
    const s = normalizeSettings(settings);
    return s.freeDeliveryOnly || s.deliveryFeeMax > 0 || s.minOrderMax > 0;
  }

  function settingsSummary(settings) {
    const s = normalizeSettings(settings);
    const parts = [];
    if (s.freeDeliveryOnly) parts.push('gratis bezorging');
    if (s.deliveryFeeMax > 0) parts.push('bezorgkosten ≤ €' + formatPrice(s.deliveryFeeMax));
    if (s.minOrderMax > 0) parts.push('min. bestelling ≤ €' + formatPrice(s.minOrderMax));
    return parts.length ? parts.join(', ') : 'geen filters actief';
  }

  function formatPrice(value) {
    return value.toFixed(2).replace('.', ',');
  }

  const api = {
    DEFAULT_SETTINGS,
    normalizeSettings,
    parsePrice,
    matchesFilters,
    hasActiveFilters,
    settingsSummary,
    formatPrice
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.TBZ = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
