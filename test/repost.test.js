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
test('repost must be explicitly enabled and permits optional test scope', () => {
  assert.equal(readConfig({}).repostEnabled, false);
  assert.equal(readConfig({ REPOST_AS_AUTHOR: 'yes' }).repostEnabled, true);
  assert.equal(readConfig({ REPOST_AS_AUTHOR: 'yes', TEST_GUILD_ID: '123456789012345678' }).testGuildId, '123456789012345678');
});
test('preserves text, uses author identity, prevents pings without adding a repost footer', () => {
  const { message } = fixture();
  const result = buildRepostPayload(message, preview);
  assert.equal(result.content, 'Hello @everyone https://instagram.com/p/abc\n\nhttps://oginstagram.com/p/abc');
  assert.equal(result.username, 'Person');
  assert.deepEqual(result.allowedMentions, { parse: [], repliedUser: false });
  assert.doesNotMatch(result.content, /Reposted by Link Embedder/);
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

test('multiple native links and canonical aliases are not appended again', () => {
  const { message } = fixture();
  const original = 'Watch https://youtu.be/aqz-KE-bpKQ?t=1 and https://www.youtube.com/watch?v=dQw4w9WgXcQ.';
  const result = buildRepostPayload({ ...message, content: original }, {
    content: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=1\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ', embeds: []
  });
  assert.equal(result.content, original);
});

test('Instagram helper fallback strips tracking from source and adds its helper separately', () => {
  const { message } = fixture();
  const result = buildRepostPayload({...message, content: 'Look https://www.instagram.com/reel/ABC/?utm_source=share'}, {
    content: 'https://oginstagram.com/reel/ABC\nOriginal: <https://www.instagram.com/reel/ABC>', embeds: []
  });
  assert.equal(result.content, 'Look https://www.instagram.com/reel/ABC/\n\nhttps://oginstagram.com/reel/ABC');
});
test('Instagram-only approval leaves all other helpers disabled', () => {
  const config = readConfig({INSTAGRAM_SHARING_APPROVED:'yes'});
  assert.equal(config.modes.instagram, 'oginstagram');
  for (const platform of ['tiktok','twitter','reddit','bluesky','twitch','snapchat']) assert.equal(config.modes[platform], 'card');
});

test('ownership must persist before original deletion; disk failure rolls back replacement',async()=>{
 const {message,calls}=fixture(); const owners={put:async()=>{calls.push(['persist']);throw Error('disk');},remove:async()=>calls.push(['remove'])};
 await createReposter(user,()=>{},owners)(message,preview);
 assert.deepEqual(calls.map(c=>c[0]),['send','persist','rollback','remove']);
});
