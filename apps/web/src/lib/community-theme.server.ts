import 'server-only';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { themes, type CommunityThemeColors } from './themes';

export interface CommunityThemeConfig {
  baseTheme: string;
  colors: CommunityThemeColors;
}

export function loadCommunityTheme(): CommunityThemeConfig | undefined {
  const root = process.env.COMMUNITY_CONTENT_DIR;
  if (!root) return undefined;
  const file = resolve(root, 'community.json');
  const rootReal = realpathSync(root);
  if (realpathSync(file) !== resolve(rootReal, 'community.json')) throw new Error('Invalid community branding path');
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 262144) throw new Error('Invalid community manifest');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as { branding?: unknown };
  if (manifest.branding === undefined) return undefined;
  if (!manifest.branding || typeof manifest.branding !== 'object' || Array.isArray(manifest.branding)) throw new Error('Invalid community branding');
  const { theme, colors } = manifest.branding as { theme?: unknown; colors?: unknown };
  if (typeof theme !== 'string' || !themes.some(t => t.name === theme)) throw new Error('Unsupported community theme');
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) throw new Error('Invalid community theme colors');
  const entries = Object.entries(colors);
  if (entries.some(([key, value]) => !['primary', 'secondary', 'accent'].includes(key) || typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value))) {
    throw new Error('Invalid community theme colors');
  }
  return { baseTheme: theme, colors: colors as CommunityThemeColors };
}
