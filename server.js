'use strict';

const http = require('http');
const path = require('path');
const { Store } = require('./lib/db');
const { createApp } = require('./lib/app');
const { seed } = require('./lib/seed');
const { seedEntitiesInto } = require('./lib/entities');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');

const store = new Store(DB_FILE);
if (store.isEmpty() && process.env.SEED !== '0') seed(store);
if (!store.data.entities.length && process.env.SEED !== '0') seedEntitiesInto(store);

if (!process.env.ADMIN_TOKEN) {
  console.warn('Warning: ADMIN_TOKEN is not set – the admin panel is disabled.');
}

http.createServer(createApp(store)).listen(PORT, () => {
  console.log(`Promo Hub running at http://localhost:${PORT}`);
});
