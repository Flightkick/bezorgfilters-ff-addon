'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function fileExists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function run() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

  assert.strictEqual(manifest.manifest_version, 3, 'MV3 manifest');
  assert.ok(manifest.name, 'name set');
  assert.ok(/^\d+\.\d+\.\d+$/.test(manifest.version), 'semver version');
  assert.ok(manifest.browser_specific_settings.gecko.id, 'gecko id set');

  for (const cs of manifest.content_scripts) {
    for (const js of cs.js) assert.ok(fileExists(js), 'content script exists: ' + js);
    for (const css of cs.css) assert.ok(fileExists(css), 'content css exists: ' + css);
    for (const match of cs.matches) {
      assert.ok(/^https?:|\*/.test(match), 'match pattern plausible: ' + match);
    }
  }

  assert.ok(fileExists(manifest.action.default_popup), 'popup exists');
  for (const size of Object.keys(manifest.icons)) {
    assert.ok(fileExists(manifest.icons[size]), 'icon exists: ' + manifest.icons[size]);
  }

  const popup = fs.readFileSync(path.join(root, manifest.action.default_popup), 'utf8');
  for (const src of popup.match(/src="([^"]+)"/g) || []) {
    const rel = src.replace(/^src="/, '').replace(/"$/, '');
    assert.ok(fileExists(rel), 'popup script referenced: ' + rel);
  }

  for (const icon of ['icons/icon-48.png', 'icons/icon-96.png', 'icons/icon-128.png']) {
    const buf = fs.readFileSync(path.join(root, icon));
    assert.strictEqual(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', 'valid PNG: ' + icon);
  }

  console.log('Manifest and assets OK.');
}

run();
