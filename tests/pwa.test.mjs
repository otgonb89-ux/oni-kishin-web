import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = file => readFile(new URL(file, root), 'utf8');

test('manifest has deterministic relative application scope and required icons', async () => {
  const manifest = JSON.parse(await text('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  await Promise.all(manifest.icons.map(icon => access(new URL(icon.src, root))));
  await access(new URL('icons/apple-touch-icon.png', root));
});

test('tracked HTML contains PWA metadata and relative worker registration', async () => {
  const html = await text('index.html');
  for (const value of ['rel="manifest" href="manifest.webmanifest"', 'apple-mobile-web-app-capable', 'apple-touch-icon', "register('./sw.js', {scope: './'})"]) assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /serviceWorker\.register\("\/oni-kishin-web\/sw\.js"/);
});

test('mobile app layer keeps quick navigation, safe areas, and offline feedback in tracked HTML', async () => {
  const html = await text('index.html');
  for (const value of ['oni-app-dashboard', 'oniNetworkStatus', 'env(safe-area-inset-bottom)', 'oniAppMemberCount', 'oniAppMeetStatus', 'oniIntroSeen', 'aria-label="Voice input"']) assert.match(html, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /href="#oni-meet"/);
  assert.match(html, /href="admin\.html"/);
});

test('service worker versions caches and includes offline navigation fallback', async () => {
  const worker = await text('sw.js');
  assert.match(worker, /CACHE_VERSION = 'oni-hub-v2'/);
  assert.match(worker, /offline\.html/);
  assert.match(worker, /networkFirst\(request, asset\('offline\.html'\)\)/);
  assert.match(worker, /SKIP_WAITING/);
});

test('GitHub Pages workflow deploys tracked source without mutating it', async () => {
  const workflow = await text('.github/workflows/main.yml');
  assert.doesNotMatch(workflow, /Prepare PWA shell/);
  assert.doesNotMatch(workflow, /write_text\(s/);
});
