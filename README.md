# Thuisbezorgd Filters (Firefox add-on)

A Firefox add-on that enhances [Thuisbezorgd.nl](https://www.thuisbezorgd.nl) by adding
price-based filters the site itself does not offer:

- **Delivery fee range** (minimum and/or maximum, in euros)
- **Minimum order amount** (maximum, in euros)
- **Free delivery only** toggle

Non-matching restaurants can be **hidden** or **dimmed**, and the filter state persists
across sessions.

## How it works

- A content script runs on Thuisbezorgd listing pages, observes the DOM with a
  `MutationObserver` (the list is rendered client-side and updates as you scroll/filter),
  extracts each restaurant card's delivery fee and minimum order amount, and applies the
  filters by hiding or dimming cards.
- A collapsible filter panel is injected above the restaurant list for quick access.
- A toolbar popup offers the same settings and works on any Thuisbezorgd page.
- Settings are stored via `browser.storage.local` and stay in sync between the panel
  and the popup.

> **Note on selectors:** Thuisbezorgd's frontend changes frequently. The card/fee
> selectors are defined at the top of `content.js` and are intentionally kept in one
> place so they are easy to update when the site changes.

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

Runs the unit tests for price parsing and filter matching plus a manifest/asset check.

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
- Filter behavior depends on visible card data only — it does not call Thuisbezorgd
  APIs.
