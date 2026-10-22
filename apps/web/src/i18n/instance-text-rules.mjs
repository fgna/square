// Rules for instance texts: i18n/{de,en}/overrides.json in a content pack lets
// an instance replace any existing Core UI text with its own wording (tone,
// terms, culture). Shared by the web app (at runtime) and by
// scripts/validate-instance-pack.mjs (before deployment), so both check the same.
//
// Guard rails:
// - only keys the Core already has, no new keys;
// - only placeholders the Core text uses (the UI passes no others);
// - plain text: no HTML, no links; rich-text tags only if the Core text has them;
// - at most MAX_LENGTH characters;
// - every key in both languages;
// - a few protected texts stay as the Core has them (PROTECTED_KEYS).

export const MAX_LENGTH = 2000;

/**
 * Texts whose wording must not change, because a different wording could
 * mislead members about their security or their rights: the password rules
 * the platform actually enforces, the data rights, and the confirmation of
 * irreversible account deletion.
 */
export const PROTECTED_KEYS = [
  'auth.passwordMinLength',
  'auth.passwordComplexity',
  'settings.privacy.gdprDescription',
  'settings.privacy.deleteConfirmation',
  'settings.privacy.dangerSubtitle',
  'adminUsersUI.deleteExplain',
  'adminUsersUI.deleteConfirm',
];

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Flattens nested messages to { 'a.b.c': value }. */
export function flattenMessages(tree, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(tree)) {
    if (object(value)) Object.assign(out, flattenMessages(value, prefix + key + '.'));
    else out[prefix + key] = value;
  }
  return out;
}

/**
 * Argument names of an ICU message ({name}, {count, plural, one {…} other {…}},
 * nested arguments in branches). Throws on unbalanced braces.
 */
export function icuArguments(text) {
  const args = new Set();
  let i = 0;
  const fail = () => {
    throw new Error('invalid message syntax');
  };
  const match = (re) => {
    const m = re.exec(text.slice(i));
    if (!m) fail();
    i += m[0].length;
    return m;
  };
  function message(nested) {
    while (i < text.length) {
      const ch = text[i];
      if (ch === "'") {
        // ICU quoting: '' is an apostrophe, '{…' starts a quoted literal.
        if (text[i + 1] === "'") i += 2;
        else if (text[i + 1] === '{' || text[i + 1] === '}') {
          const end = text.indexOf("'", i + 1);
          i = end === -1 ? text.length : end + 1;
        } else i++;
      } else if (ch === '{') {
        i++;
        argument();
      } else if (ch === '}') {
        if (!nested) fail();
        i++;
        return;
      } else i++;
    }
    if (nested) fail();
  }
  function argument() {
    args.add(match(/^\s*([A-Za-z_][\w]*)\s*/)[1]);
    if (text[i] === '}') return void i++;
    if (text[i] !== ',') fail();
    i++;
    const type = match(/^\s*(\w+)\s*/)[1];
    if (text[i] === '}') return void i++;
    if (text[i] !== ',') fail();
    i++;
    if (type === 'plural' || type === 'select' || type === 'selectordinal') {
      for (;;) {
        match(/^\s*(?:offset:\s*\d+\s*)?/);
        if (text[i] === '}') return void i++;
        match(/^\s*(=?[\w-]+)\s*/);
        if (text[i] !== '{') fail();
        i++;
        message(true);
      }
    }
    const end = text.indexOf('}', i);
    if (end === -1) fail();
    i = end + 1;
  }
  message(false);
  return args;
}

const TAG = /<\/?([A-Za-z][\w-]*)\s*\/?>/g;
const tagsOf = (text) => new Set([...text.matchAll(TAG)].map((m) => m[1]));

/** Problems with one replacement text, compared with the Core text it replaces. */
export function textProblems(value, reference) {
  if (typeof value !== 'string' || !value.trim()) return ['must be non-empty text'];
  const problems = [];
  if (value.length > MAX_LENGTH) problems.push(`longer than ${MAX_LENGTH} characters`);
  const allowedTags = tagsOf(reference);
  const extraTags = [...tagsOf(value)].filter((t) => !allowedTags.has(t));
  if (extraTags.length) problems.push(`uses markup <${extraTags[0]}> that the Core text does not have`);
  if (/<[A-Za-z/!]/.test(value.replace(TAG, ''))) problems.push('contains HTML');
  if (/https?:\/\/|www\./i.test(value)) problems.push('contains a link');
  let used;
  try {
    used = icuArguments(value);
  } catch {
    return [...problems, 'has unbalanced braces'];
  }
  let offered;
  try {
    offered = icuArguments(reference);
  } catch {
    offered = new Set();
  }
  const unknown = [...used].filter((a) => !offered.has(a));
  if (unknown.length) problems.push(`uses placeholder {${unknown[0]}} that the Core does not provide`);
  return problems;
}

/**
 * Checks both languages' overrides against the Core catalogs. Returns a list
 * of problems ("de: nav.feed: contains a link"); empty means valid.
 */
export function overrideProblems(overrides, base) {
  const problems = [];
  const keys = {};
  for (const locale of ['de', 'en']) {
    if (!object(overrides[locale])) {
      problems.push(`${locale}: overrides must be an object`);
      keys[locale] = [];
      continue;
    }
    const flat = flattenMessages(overrides[locale]);
    const reference = flattenMessages(base[locale]);
    keys[locale] = Object.keys(flat);
    for (const [key, value] of Object.entries(flat)) {
      if (PROTECTED_KEYS.includes(key)) problems.push(`${locale}: ${key}: protected, stays as in the Core`);
      else if (typeof reference[key] !== 'string') problems.push(`${locale}: ${key}: no such Core text`);
      else for (const p of textProblems(value, reference[key])) problems.push(`${locale}: ${key}: ${p}`);
    }
  }
  const [de, en] = [new Set(keys.de), new Set(keys.en)];
  for (const key of de) if (!en.has(key)) problems.push(`en: ${key}: missing (given in de)`);
  for (const key of en) if (!de.has(key)) problems.push(`de: ${key}: missing (given in en)`);
  return problems;
}

/** Applies validated overrides to one catalog without changing it. */
export function applyOverrides(catalog, overrides) {
  const out = structuredClone(catalog);
  for (const [key, value] of Object.entries(flattenMessages(overrides))) {
    const parts = key.split('.');
    let node = out;
    for (const part of parts.slice(0, -1)) node = node[part];
    node[parts[parts.length - 1]] = value;
  }
  return out;
}
