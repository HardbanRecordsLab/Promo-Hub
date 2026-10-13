'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'public');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n-pl.js'), 'utf8'), sandbox);
const PL = sandbox.window.PH_PL;

const keys = new Set();
for (const m of appSrc.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every UI text has a Polish translation', () => {
  assert.ok(keys.size > 300, `found ${keys.size} keys`);
  const missing = [...keys].filter((k) => !PL[k]);
  assert.deepEqual(missing, [], `missing PL translations:\n${missing.join('\n')}`);
});

test('translations keep the same {placeholders}', () => {
  const broken = [...keys].filter((k) => PL[k] && params(k) !== params(PL[k]));
  assert.deepEqual(broken, [], `placeholder mismatch:\n${broken.join('\n')}`);
});

test('no unused entries in the Polish dictionary', () => {
  const unused = Object.keys(PL).filter((k) => !keys.has(k));
  assert.deepEqual(unused, []);
});

test('UI strings are not built with template literals inside t()', () => {
  assert.equal(/\bt\(`/.test(appSrc), false, 't() must receive a plain string literal');
});
