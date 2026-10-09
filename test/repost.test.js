import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepostPayload, canRepost, createReposter } from '../src/repost.js';
import { readConfig } from '../src/config.js';

const user = { id: 'bot' };
const preview = { content: 'https://oginstagram.com/p/abc', embeds: [] };
function fixture() {
  const calls = [];
  const hook = { owner: user, name: 'Link Embedder Reposts', token: 'test-only',
    send: async payload => { calls.push(['send', payload]); return { id: 'replacement' }; },
    deleteMessage: async () => calls.push(['rollback']) };
  const message = { id: 'original', type: 0, deletable: true, content: 'Hello @everyone https://instagram.com/p/abc',
    author: { username: 'Person', displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png' },
    channel: { type: 0, permissionsFor: () => ({ has: () => true }),
      fetchWebhooks: async () => [hook], messages: { fetch: async () => message } },
    delete: async () => calls.push(['delete']) };
  return { calls, hook, message };
}
test('repost must be explicitly enabled and limited to a server and channels', () => {
  assert.equal(readConfig({}).repostEnabled, false);
  assert.throws(() => readConfig({ REPOST_AS_AUTHOR: 'yes' }));
  assert.throws(() => readConfig({ REPOST_AS_AUTHOR: 'yes', TEST_GUILD_ID: '123456789012345678' }));
});
test('preserves text, uses author identity, prevents pings and labels the bot repost', () => {
  const { message } = fixture();
  const result = buildRepostPayload(message, preview);
  assert.ok(result.content.startsWith(message.content));
  assert.equal(result.username, 'Person');
  assert.deepEqual(result.allowedMentions, { parse: [], repliedUser: false });
  assert.match(result.content, /Reposted by Link Embedder/);
  assert.equal(buildRepostPayload({ ...message, content: 'x'.repeat(2000) }, preview), null);
});
test('never replaces attachments, replies, polls, threads, reactions or suppressed messages', () => {
  const { message } = fixture();
  for (const change of [{ attachments: { size: 1 } }, { stickers: { size: 1 } }, { reference: {} },
    { poll: {} }, { pinned: true }, { hasThread: true }, { components: [{}] }, { reactions: { cache: { size: 1 } } },
    { flags: { has: () => true } }, { deletable: false }, { channel: { type: 11 } }]) {
    assert.equal(canRepost({ ...message, ...change }, user), false);
  }
});
test('confirms webhook replacement before deleting original', async () => {
  const { message, calls } = fixture();
  assert.equal(await createReposter(user)(message, preview), true);
  assert.deepEqual(calls.map(c => c[0]), ['send', 'delete']);
});
test('send failure leaves original intact and logs no error content', async () => {
  const { message, hook, calls } = fixture();
  hook.send = async () => { throw new Error('private content and token'); };
  const logs = [];
  await createReposter(user, code => logs.push(code))(message, preview);
  assert.deepEqual(calls, []);
  assert.deepEqual(logs, ['repost_failed_original_preserved_or_delete_unconfirmed']);
});
test('changed source is retained and replacement rolled back', async () => {
  const { message, calls } = fixture();
  message.channel.messages.fetch = async () => ({ ...message, content: 'edited' });
  await createReposter(user)(message, preview);
  assert.deepEqual(calls.map(c => c[0]), ['send', 'rollback']);
});
test('lost delete acknowledgement never removes the only confirmed replacement', async () => {
  const { message, calls } = fixture();
  message.delete = async () => {
    calls.push(['delete']);
    message.channel.messages.fetch = async () => { throw new Error('unknown message'); };
    throw new Error('lost response');
  };
  await createReposter(user)(message, preview);
  assert.deepEqual(calls.map(c => c[0]), ['send', 'delete']);
});
test('missing permissions avoids webhook access and preserves original', async () => {
  const { message, calls } = fixture();
  message.channel.permissionsFor = () => ({ has: () => false });
  assert.equal(await createReposter(user)(message, preview), false);
  assert.deepEqual(calls, []);
});

test('an identical native URL appears only once in the repost', () => {
  const { message } = fixture();
  const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const payload = buildRepostPayload({ ...message, content: 'Test ' + url }, { content: url, embeds: [] });
  assert.equal(payload.content.split(url).length - 1, 1);
});
