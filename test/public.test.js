import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits as P } from 'discord.js';
import { readConfig } from '../src/config.js';
import { createHandler } from '../src/handler.js';
import { canSendPreview } from '../src/permissions.js';
import { parseSocialUrl, buildPayload } from '../src/previews.js';

test('one operator approval enables documented proxy defaults without per-server configuration', () => {
  const config = readConfig({ PROVIDER_SHARING_APPROVED: 'yes' });
  assert.equal(config.modes.instagram, 'oginstagram');
  assert.equal(config.modes.twitter, 'fxembed');
  assert.equal(config.modes.snapchat, 'snapchatez');
  assert.equal(config.modes.amazon, 'native');
  assert.equal(config.modes.facebook, 'card');
  assert.equal(config.modes.mastodon, 'card');
});

test('effective permissions use thread-specific send and reject unavailable thread/channel states', () => {
  const user = { id: 'bot' };
  const channel = { isTextBased: () => true, isSendable: () => true, isThread: () => false,
    permissionsFor: () => ({ has: flags => flags.every(f => [P.ViewChannel, P.SendMessages, P.EmbedLinks].includes(f)) }) };
  assert.equal(canSendPreview({ channel }, user), true);
  channel.isThread = () => true;
  channel.parent = { nsfw: false };
  assert.equal(canSendPreview({ channel }, user), false);
  channel.permissionsFor = () => ({ has: flags => flags.every(f => [P.ViewChannel, P.SendMessagesInThreads, P.EmbedLinks].includes(f)) });
  assert.equal(canSendPreview({ channel }, user), true);
  for (const extra of [{ archived: true }, { locked: true }, { type: 12, joined: false }, { isSendable: () => false }, { permissionsFor: () => null }]) {
    assert.equal(canSendPreview({ channel: { ...channel, ...extra } }, user), false);
  }
  assert.equal(canSendPreview({ channel: { ...channel, type: 12, joined: true } }, user), true);
  for (const extra of [{ nsfw: true }, { parent: { nsfw: true } }, { parent: null }, { parent: {} }]) {
    assert.equal(canSendPreview({ channel: { ...channel, ...extra } }, user), true);
  }
});

test('explicit disabled-bot mode shuts down every preview; normal configuration is enabled', async () => {
  assert.equal(readConfig({}).previewsDisabled, false);
  assert.equal(readConfig({ PREVIEWS_DISABLED: 'no' }).previewsDisabled, false);
  assert.equal(readConfig({ REQUIRE_VERIFIED_SAFE_CONTENT: 'yes' }).previewsDisabled, true);
  const handle = createHandler(readConfig({ PREVIEWS_DISABLED: 'yes' }), {
    canSend: () => assert.fail('disabled mode must stop before processing content')
  });
  await handle({ guildId: 'guild', content: 'https://instagram.com/p/abc' });
});

test('ordinary public links work across channel age labels while inaccessible and locked threads stay blocked', async () => {
  const sent = [];
  const user = { id: 'bot' };
  const handle = createHandler(readConfig({ PREVIEWS_DISABLED: 'no' }), {
    canSend: message => canSendPreview(message, user),
    makeInstagramPayload: async content => ({flags:32768,components:[{type:10,content},{type:17,components:[{type:10,content:'YouTube'}]}]})
  });
  const base = { isTextBased: () => true, isSendable: () => true, isThread: () => false,
    nsfw: false, permissionsFor: () => ({ has: () => true }), send: async payload => sent.push(payload) };
  const inputs = [
    {}, { isThread: () => true, parent: { nsfw: false } },
    { nsfw: true }, { parent: { nsfw: true } },
    { isThread: () => true, parent: { nsfw: true } }, { isThread: () => true },
    { isThread: () => true, locked: true }, { isThread: () => true, archived: true },
    { isThread: () => true, type: 12, joined: false }, { permissionsFor: () => null }
  ];
  for (const [index, channel] of inputs.entries()) {
    await handle({ guildId: 'guild', channelId: `channel${index}`, id: `id${index}`,
      content: 'https://youtube.com/watch?v=dQw4w9WgXcQ&si=tracking', channel: { ...base, ...channel } });
  }
  assert.equal(sent.length, 6);
  assert.equal(sent[0].reply.messageReference,'id0');assert.equal(sent[0].components[0].type,17);assert.equal(sent[0].content,undefined);
});

test('public routing accepts multiple guilds and isolates dedupe and server burst limits', async () => {
  const sent = [];
  const handle = createHandler(readConfig({}), { canSend: () => true, now: () => 1000 });
  const msg = (guildId, channelId, id) => ({ guildId, channelId, id, content: 'https://instagram.com/p/abc', author: {}, channel: { send: async () => sent.push(guildId) } });
  for (let n = 0; n < 21; n++) await handle(msg('a', `channel${n}`, `${n}`));
  assert.equal(sent.length, 20);
  await handle(msg('b', 'channel0', '0'));
  assert.equal(sent.at(-1), 'b');
  assert.equal(sent.length, 21);
  await handle(msg(null, 'channel', 'id'));
  assert.equal(sent.length, 21);
});

test('permissions are checked on every event after a permission change', async () => {
  let permitted = true;
  let sent = 0;
  const handle = createHandler(readConfig({}), { canSend: () => permitted });
  const msg = { guildId: 'a', channelId: 'one', id: '1', content: 'https://instagram.com/p/abc', channel: { send: async () => sent++ } };
  await handle(msg);
  permitted = false;
  await handle({ ...msg, channelId: 'two', id: '2' });
  assert.equal(sent, 1);
});

test('production handles newly available channels without membership calls or allowlist updates', async () => {
  let allowed = false;
  const sent = [];
  const config = readConfig({});
  assert.equal(config.channelIds.size, 0);
  const handle = createHandler(config, { canSend: () => allowed });
  const input = { guildId: 'server', channelId: 'new-channel', id: 'one', content: 'https://instagram.com/p/abc',
    channel: { send: async payload => sent.push(payload) } };
  await handle(input);
  assert.equal(sent.length, 0);
  allowed = true;
  await handle({ ...input, id: 'two' });
  await handle({ ...input, channelId: 'another-new-channel', id: 'three' });
  assert.equal(sent.length, 2);
});

test('documented proxy routes retain only cleaned public post URLs', () => {
  const fixtures = [
    ['https://x.com/person/status/123?utm_source=share', 'twitter', 'fxembed', 'https://fxtwitter.com/person/status/123'],
    ['https://bsky.app/profile/person.bsky.social/post/abc123', 'bluesky', 'fxembed', 'https://fxbsky.app/profile/person.bsky.social/post/abc123'],
    ['https://reddit.com/r/test/comments/abc123/title?utm_source=share', 'reddit', 'vxreddit', 'https://vxreddit.com/r/test/comments/abc123/title'],
    ['https://www.twitch.tv/person/clip/Clip-123?utm_source=share', 'twitch', 'fxtwitch', 'https://fxtwitch.seria.moe/clip/Clip-123'],
    ['https://snapchat.com/spotlight/abc123?utm_source=share', 'snapchat', 'snapchatez', 'https://snapchatez.com/spotlight/abc123']
  ];
  for (const [url, platform, mode, expected] of fixtures) {
    const payload = buildPayload(url, { [platform]: mode });
    assert.ok(payload.content.startsWith(expected), payload.content);
    assert.doesNotMatch(payload.content, /utm_source/);
  }
});

test('native YouTube recognizes Shorts and avoids an already present canonical preview', () => {
  const input = 'https://youtube.com/shorts/dQw4w9WgXcQ?si=secret';
  assert.equal(buildPayload(input, { youtube: 'native' }).content, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(buildPayload(input, { youtube: 'native' }, [{ url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' }]), null);
});

test('RedNote keeps access parameters, Mastodon stays on explicit instances without proxy', () => {
  const link = parseSocialUrl('https://xiaohongshu.com/explore/abc123?xsec_token=public-share-token&xsec_source=pc_share&utm_source=tracking');
  assert.match(link.url, /xsec_token=public-share-token/);
  assert.match(link.url, /xsec_source=pc_share/);
  assert.doesNotMatch(link.url, /utm_source/);
  assert.equal(parseSocialUrl('https://mastodon.social/@person/123').platform, 'mastodon');
  assert.equal(parseSocialUrl('https://arbitrary.example/@person/123'), null);
  assert.throws(() => readConfig({ MASTODON_MODE: 'native' }));
  assert.throws(() => readConfig({ MASTODON_MODE: 'fxmastodon', PROVIDER_SHARING_APPROVED: 'yes' }));
  assert.equal(parseSocialUrl('https://snapchat.com/stories/private'), null);
  assert.equal(parseSocialUrl('https://twitch.tv/person'), null);
  assert.equal(parseSocialUrl('https://xhslink.com/o/short'), null);
});

test('fallback platforms recognize narrow routes and all payload text stays within Discord limits', () => {
  assert.equal(parseSocialUrl('https://linkedin.com/feed/update/urn:li:activity:123').platform, 'linkedin');
  assert.equal(parseSocialUrl('https://share.upscrolled.com/en/post/12345678-1234-1234-1234-123456789abc').platform, 'upscrolled');
  assert.equal(parseSocialUrl('https://linkedin.com/messaging/thread/123'), null);
  const huge = 'https://snapchat.com/spotlight/abc?functional=' + 'x'.repeat(1800);
  assert.equal(buildPayload(huge, { snapchat: 'snapchatez' }), null);
});
