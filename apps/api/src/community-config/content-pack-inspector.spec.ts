import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectCommunityContentPack } from './content-pack-inspector';

const roots: string[] = [];
async function fixture(manifest: Record<string, unknown>, file?: string) {
  const root = await mkdtemp(join(tmpdir(), 'community-pack-'));
  roots.push(root);
  await writeFile(join(root, 'community.json'), JSON.stringify(manifest));
  if (file) {
    await mkdir(join(root, 'assessment'), { recursive: true });
    await writeFile(join(root, file), JSON.stringify({ questions: [] }));
  }
  return root;
}
const manifest = {
  schemaVersion: 1, id: 'example-pack', version: '1.0.0',
  platformCompatibility: '^1.0.0', locales: ['de', 'en'],
  assessment: { instrumentId: 'example-assessment', instrumentVersion: 'v1', definition: 'assessment/data.json' },
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});

describe('inspectCommunityContentPack', () => {
  it('inspects a local pack without installing or modifying it', async () => {
    const root = await fixture(manifest, 'assessment/data.json');
    const result = await inspectCommunityContentPack(root);
    expect(result.manifest.id).toBe('example-pack');
    expect(result.files[0]).toMatchObject({ path: 'assessment/data.json' });
    expect(result.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('supports a community without assessment', async () => {
    const root = await fixture({ ...manifest, assessment: undefined });
    expect((await inspectCommunityContentPack(root)).files).toEqual([]);
  });
  it('rejects missing file and traversal', async () => {
    const root = await fixture(manifest);
    await expect(inspectCommunityContentPack(root)).rejects.toThrow();
    const badRoot = await fixture({
      ...manifest, assessment: { ...manifest.assessment, definition: '../outside.json' },
    });
    await expect(inspectCommunityContentPack(badRoot)).rejects.toThrow();
  });
  it('rejects a symlinked ancestor directory even when the JSON is valid', async () => {
    const root = await fixture(manifest);
    await mkdir(join(root, 'real'));
    await writeFile(join(root, 'real', 'data.json'), '{}');
    await symlink(join(root, 'real'), join(root, 'assessment'));
    await expect(inspectCommunityContentPack(root)).rejects.toThrow(/symlink/);
  });
  it('rejects a symlinked pack root', async () => {
    const root = await fixture({ ...manifest, assessment: undefined });
    const linked = root + '-link';
    roots.push(linked);
    await symlink(root, linked);
    await expect(inspectCommunityContentPack(linked)).rejects.toThrow(/noncanonical/);
  });
  it('rejects symlinked pack files', async () => {
    const root = await fixture(manifest);
    await symlink(join(root, 'community.json'), join(root, 'assessment-target.json'));
    await mkdir(join(root, 'assessment'));
    await symlink(join(root, 'assessment-target.json'), join(root, 'assessment/data.json'));
    await expect(inspectCommunityContentPack(root)).rejects.toThrow(/symlink/);
  });
});
