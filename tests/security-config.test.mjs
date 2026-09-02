import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = file => readFile(new URL(file, root), 'utf8');

test('Firestore rules constrain public writes and deny unlisted data by default', async () => {
  const rules = await text('firestore.rules');
  for (const value of ['hasOnly([\'last\', \'first\'', 'hasOnly([\'orderNo\', \'productId\'', 'validParticipant()', 'allow update: if false;', 'match /{document=**} { allow read, write: if false; }']) assert.match(rules, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(rules, /function canManageContent\(\) \{ return hasRole\('owner'\) \|\| hasRole\('admin'\); \}/);
});

test('Storage rules limit uploads to authorized reviewed media paths', async () => {
  const rules = await text('storage.rules');
  assert.match(rules, /request\.resource\.size <= 8 \* 1024 \* 1024/);
  assert.match(rules, /request\.resource\.size <= 20 \* 1024 \* 1024/);
  assert.match(rules, /match \/\{allPaths=\*\*\} \{ allow read, write: if false; \}/);
});

test('the public app and deployment configuration contain no private OpenAI secret', async () => {
  const [index, admin, wrangler] = await Promise.all([text('index.html'), text('admin.html'), text('wrangler.toml')]);
  assert.doesNotMatch(index + admin, /OPENAI_API_KEY|sk-[A-Za-z0-9]{20,}/);
  assert.doesNotMatch(wrangler, /OPENAI_API_KEY\s*=/);
});
