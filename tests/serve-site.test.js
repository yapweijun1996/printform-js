// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openSiteRequest, selectSiteRoot } from '../scripts/serve-site.mjs';

const temporary = [];
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'printform-site-'));
  const root = path.join(project, 'site-dist');
  temporary.push(project);
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(root, 'assets', 'app.js'), 'export {};');
  return { project, root };
}

function openedFilename(root, url) {
  const resource = openSiteRequest(root, url);
  if (!resource) return null;
  fs.closeSync(resource.descriptor);
  return resource.filename;
}

describe('site preview filesystem boundary', () => {
  it('selects only the generated site-dist directory', () => {
    const { project, root } = fixture();
    expect(selectSiteRoot([], project)).toBe(root);
    expect(() => selectSiteRoot(['.'], project)).toThrow('Custom preview roots are not supported');
  });

  it('serves ordinary files and directory indexes inside site-dist', () => {
    const { root } = fixture();
    expect(openedFilename(root, '/')).toBe(fs.realpathSync(path.join(root, 'index.html')));
    expect(openedFilename(root, '/assets/app.js?build=1')).toBe(fs.realpathSync(path.join(root, 'assets', 'app.js')));
  });

  it('rejects existing dotfiles, dot directories, keys, and databases', () => {
    const { root } = fixture();
    fs.mkdirSync(path.join(root, 'nested', '.git'), { recursive: true });
    for (const name of ['.env', 'secret.KEY', 'state.sqlite-wal']) fs.writeFileSync(path.join(root, name), 'secret');
    fs.writeFileSync(path.join(root, 'nested', '.git', 'config'), 'secret');
    for (const url of ['/.env', '/%2eenv', '/nested/.git/config', '/secret.KEY', '/state.sqlite-wal']) {
      expect(openedFilename(root, url)).toBeNull();
    }
  });

  it('rejects linked files, linked directories, and linked preview roots', () => {
    const { project, root } = fixture();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'printform-secret-'));
    temporary.push(outside);
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret');
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'linked.txt'));
    fs.symlinkSync(outside, path.join(root, 'linked-directory'), 'dir');
    expect(openedFilename(root, '/linked.txt')).toBeNull();
    expect(openedFilename(root, '/linked-directory/secret.txt')).toBeNull();
    fs.rmSync(root, { recursive: true, force: true });
    fs.symlinkSync(outside, root, 'dir');
    expect(() => selectSiteRoot([], project)).toThrow('not a link');
  });

  it('returns no resource for malformed or escaping request paths', () => {
    const { project, root } = fixture();
    fs.writeFileSync(path.join(project, 'outside.txt'), 'secret');
    expect(openedFilename(root, '/%zz')).toBeNull();
    expect(openedFilename(root, '/%2e%2e/outside.txt')).toBeNull();
  });
});
