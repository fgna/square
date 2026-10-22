#!/usr/bin/env node
/**
 * Conservative source-driven inventory of literal next-intl namespace/key calls.
 * Does not execute source files, evaluate templates, or load private instance packs.
 * Dynamic namespaces/keys are reported for manual review, not assumed valid.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../apps/web');
const src = join(root, 'src');
const catalogs = Object.fromEntries(['de', 'en'].map(locale => [
  locale, JSON.parse(readFileSync(join(root, 'messages', locale + '.json'), 'utf8')),
]));

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.spec\.|\.test\./.test(entry.name)) yield path;
  }
}
function containsKey(catalog, key) {
  return key.split('.').reduce((value, part) => value !== null &&
    typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part) ? value[part] : undefined, catalog) !== undefined;
}
// Generic platform catalogs must have identical structure. Instance-owned method
// translations are separately validated by the bilingual pack loader.
function leafPaths(input, prefix = '') {
  return Object.entries(input).flatMap(([key, value]) => {
    const path = prefix ? prefix + '.' + key : key;
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? leafPaths(value, path) : [path];
  });
}
const baseParity = [];
const pathsByLocale = Object.fromEntries(Object.entries(catalogs).map(([locale, value]) => [locale, new Set(leafPaths(value))]));
for (const locale of Object.keys(catalogs)) {
  const other = locale === 'en' ? 'de' : 'en';
  for (const key of pathsByLocale[locale]) {
    if (!pathsByLocale[other].has(key)) baseParity.push({ locale, key, absentIn: other });
  }
}
const findings = [];
const dynamic = [];
const namespaces = new Set();

for (const file of files(src)) {
  const source = readFileSync(file, 'utf8');
  const short = relative(root, file);
  // Accept literal useTranslations() declarations, including aliases like adminT.
  const declarations = /\b(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*(['"])(.*?)\2\s*\)/g;
  for (const declaration of source.matchAll(declarations)) {
    const [, variable, , namespace] = declaration;
    namespaces.add(namespace);
    const calls = new RegExp('\\b' + variable + '\\s*\\(\\s*([\\\'"\x60])([^\\\'"\x60]*?)\\1', 'g');
    for (const call of source.matchAll(calls)) {
      if (call[1] === '\x60' && call[2].includes('${')) {
        dynamic.push({ file: short, namespace, expression: call[2].slice(0, 90) });
        continue;
      }
      const key = namespace ? namespace + '.' + call[2] : call[2];
      for (const [locale, catalog] of Object.entries(catalogs)) {
        if (!containsKey(catalog, key)) findings.push({ file: short, locale, key });
      }
    }
    // Approximate dynamic call inventory; requires human review rather than treating it as covered.
    const variableCalls = new RegExp('\\b' + variable + '\\s*\\(\\s*(?![\\\'"\x60])([^\\)]+)\\)', 'g');
    for (const call of source.matchAll(variableCalls)) {
      dynamic.push({ file: short, namespace, expression: call[1].trim().slice(0, 90) });
    }
  }
}
for (const namespace of [...namespaces].sort()) {
  for (const [locale, catalog] of Object.entries(catalogs)) {
    if (!containsKey(catalog, namespace)) findings.push({ file: '(namespace)', locale, key: namespace });
  }
}
const uniqueDynamic = [...new Map(dynamic.map(item => [JSON.stringify(item), item])).values()];
console.log(JSON.stringify({
  scannedNamespaceCount: namespaces.size,
  missing: findings,
  baseCatalogParity: baseParity,
  dynamicCallsForReview: uniqueDynamic,
  dynamicOccurrenceCount: dynamic.length,
  limitations: [
    'Static inventory only; nested or aliased translators and getTranslations calls may be missed.',
    'Dynamic calls require manual review.',
    'Private instance packs are intentionally not read.',
  ],
}, null, 2));
if (process.argv.includes('--strict') && (findings.length || baseParity.length)) process.exitCode = 1;
