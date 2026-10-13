'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Prosty magazyn JSON w jednym pliku. Zapis atomowy (plik tymczasowy + rename).
class Store {
  constructor(file) {
    this.file = file;
    this.data = { outlets: [], submissions: [] };
    if (file && fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  }

  isEmpty() {
    return this.data.outlets.length === 0;
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function newSecret() {
  return crypto.randomBytes(18).toString('base64url');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('hex');
}

function secretMatches(secret, hash) {
  if (!secret || !hash) return false;
  const a = Buffer.from(hashSecret(secret), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { Store, newId, newSecret, hashSecret, secretMatches };
