'use strict';

const http = require('http');
const path = require('path');
const { Store } = require('./lib/db');
const { createApp } = require('./lib/app');
const { seed } = require('./lib/seed');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'db.json');

const store = new Store(DB_FILE);
if (store.isEmpty() && process.env.SEED !== '0') seed(store);

if (!process.env.ADMIN_TOKEN) {
  console.warn('Uwaga: brak ADMIN_TOKEN – panel administratora jest wyłączony.');
}

http.createServer(createApp(store)).listen(PORT, () => {
  console.log(`Promo Hub działa: http://localhost:${PORT}`);
});
