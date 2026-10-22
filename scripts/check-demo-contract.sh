#!/usr/bin/env bash
# Read-only static checks for the isolated demo infrastructure.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
bash -n scripts/dev-instance-up.sh
bash -n scripts/dev-instance-down.sh
bash -n scripts/build-local-android-apk.sh
node <<'JS'
const fs=require('fs');
const de=JSON.parse(fs.readFileSync('apps/web/messages/de.json','utf8'));
const en=JSON.parse(fs.readFileSync('apps/web/messages/en.json','utf8'));
for (const [locale,catalog] of [['de',de],['en',en]]) {
  for (const ns of ['landingUI','nav','adminLayoutUI','adminCategoriesUI','dashboard','assessment','privacyNotice','getAppUI']) {
    if (!catalog[ns]) throw Error(locale+': missing '+ns);
  }
  for (const [ns,keys] of Object.entries({
    landingUI:['heroPrefix','heroSuffix','join','signin'],
    nav:['dashboard','feed','members','assessment','journal','events'],
    adminLayoutUI:['categories','assessment','settings','panel','menu'],
    adminCategoriesUI:['title','add','deleteConfirm','create','save'],
    getAppUI:['title','download','unavailable'],
  })) {
    for(const key of keys) {
      if(typeof catalog[ns][key]!=='string'||!catalog[ns][key].trim()) throw Error(locale+': '+ns+'.'+key);
    }
  }
}
console.log('DE/EN public, admin and download catalog contract: PASS');
JS
grep -q 'https://192.168.1.121:4443' config/local-Caddyfile
grep -q 'reverse_proxy 127.0.0.1:4301' config/local-Caddyfile
grep -q 'API_INTERNAL_URL' apps/web/next.config.ts
grep -q 'tls internal' config/local-Caddyfile
echo 'Local HTTPS and shell static contract: PASS'
