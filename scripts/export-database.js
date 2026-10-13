'use strict';

// Exports the Global Entity Database seed to database/global-database.csv
// (UTF-8 with BOM so Excel shows accents correctly). The file uses the same columns
// as the admin CSV import, so it can be edited in a spreadsheet and imported back.
// Usage: npm run export:db

const fs = require('fs');
const path = require('path');
const { Store } = require('../lib/db');
const { seedEntitiesInto, toCsv } = require('../lib/entities');

const store = new Store(null);
seedEntitiesInto(store);
const rows = [...store.data.entities].sort((a, b) =>
  a.region.localeCompare(b.region) || a.country.localeCompare(b.country) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

const out = path.join(__dirname, '..', 'database', 'global-database.csv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `﻿${toCsv(rows)}\n`);
console.log(`Saved ${rows.length} entities from ${new Set(rows.map((e) => e.country)).size} countries → ${path.relative(process.cwd(), out)}`);
