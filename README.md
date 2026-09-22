# Thuisbezorgd Filters (Firefox add-on)

A Firefox add-on that enhances [Thuisbezorgd.nl](https://www.thuisbezorgd.nl) by adding
price-based filters the site itself does not offer:

- **Delivery fee** (maximum, in euros; enter `0` for free delivery only)
- **Minimum order amount** (maximum, in euros)

An empty field means "no filter". Non-matching restaurants are **dimmed** (kept visible
but greyed out), and the filter state persists across sessions. Dimming keeps the page
layout intact, including for lazily loaded cards. The panel and popup follow the site's
light/dark theme via `prefers-color-scheme`.

## How it works

- A content script runs on Thuisbezorgd listing pages, observes the DOM with a
  `MutationObserver` (the list is rendered client-side and updates as you scroll/filter),
  extracts each restaurant card's delivery fee and minimum order amount, and dims
  non-matching cards.
- A collapsible filter panel is injected above the restaurant list for quick access.
- A toolbar popup offers the same settings and works on any Thuisbezorgd page.
- Settings are stored via `browser.storage.local` and stay in sync between the panel
  and the popup.

> **Note on selectors:** Thuisbezorgd's frontend changes frequently. The card/fee
> selectors are defined at the top of `content.js` and are intentionally kept in one
> place so they are easy to update when the site changes. The current selectors are
> based on the site's `data-qa` attributes (`restaurant-card`,
> `restaurant-delivery-fee`, `restaurant-mov`, `restaurant-info-name`) and are
> verified by the DOM integration test against a captured listing page fixture.

## Project layout

```
manifest.json          Add-on manifest (MV3, Firefox)
content.js            Content script: card discovery, filtering, injected panel
content.css           Styles for the injected panel and hidden/dimmed cards
lib/filters.js        Shared filter logic (pure, unit-tested)
popup.html/.js/.css   Toolbar popup
icons/                Add-on icons
test/                 Node unit tests (no dependencies)
```

## Development

No build step and no dependencies. Load the add-on directly:

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Pick `manifest.json` in this repository

### Tests

```bash
npm test
```

Runs the unit tests for price parsing and filter matching, a jsdom-based DOM
integration test (extraction + hide/dim behavior against a captured listing-page
fixture), and a manifest/asset check. Requires `npm install` once (dev dependency:
jsdom).

### Packaging

Zip the repository contents (manifest at the zip root) or use
[web-ext](https://github.com/mozilla/web-ext):

```bash
npx web-ext build
```

CI (GitHub Actions) runs the tests and uploads a build artifact on every push.

## Limitations

- Only `www.thuisbezorgd.nl` is targeted (matches in `manifest.json`).
- Delivery fee and minimum order values are read from what the site renders; if the
  site changes its markup, selectors in `content.js` need updating.
- "Free delivery available" tags are treated as free delivery (fee 0).
- Cards with unreadable/missing fees are shown by default rather than hidden.
- Stored settings from older versions (hide mode, fee minimum, free-delivery toggle) are
  migrated automatically; a stored `0` fee from those versions is treated as "unset".
