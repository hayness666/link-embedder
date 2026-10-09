import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialUrl, extractLinks, buildPayload } from '../src/previews.js';
import { readConfig } from '../src/config.js';
import { createHandler } from '../src/handler.js';

const env = { DISCORD_GUILD_ID: '123456789012345678', DISCORD_CHANNEL_IDS: '234567890123456789' };
const config = readConfig(env);
const ig = 'https://www.instagram.com/reel/ABC_123/';
function message(overrides = {}) {
  return { id: '345678901234567890', guildId: env.DISCORD_GUILD_ID,
    channelId: env.DISCORD_CHANNEL_IDS, author: { bot: false }, content: ig,
    channel: { isThread: () => false, send: async () => {} }, ...overrides };
}

test('defaults to public routing; validates optional isolation and rejects unknown modes', () => {
  assert.equal(readConfig({}).testGuildId, null);
  assert.equal(readConfig({}).channelIds.size, 0);
  for (const bad of [{ TEST_GUILD_ID: 'bad' }, { TEST_CHANNEL_IDS: env.DISCORD_CHANNEL_IDS }, { ...env, FACEBOOK_MODE: 'facebed' }]) {
    assert.throws(() => readConfig(bad));
  }
  assert.throws(() => readConfig({ INSTAGRAM_MODE: 'oginstagram' }));
  assert.equal(readConfig({ ...env, INSTAGRAM_MODE: 'oginstagram', PROVIDER_SHARING_APPROVED: 'yes' }).modes.instagram, 'oginstagram');
});

test('accepts canonical reel, video and photo routes and strips tracking', () => {
  const cases = [
    [ig + '?igsh=secret#fragment', 'instagram', 'reel'],
    ['https://instagram.com/p/xyz', 'instagram', 'photo or post'],
    ['https://tiktok.com/@person/video/123?tracking=x', 'tiktok', 'video'],
    ['https://www.tiktok.com/@person/photo/123', 'tiktok', 'photo'],
    ['https://m.facebook.com/reel/123', 'facebook', 'reel'],
    ['https://facebook.com/photo.php?fbid=123&set=private&tracking=x', 'facebook', 'photo'],
    ['https://facebook.com/person/photos/a.123/456', 'facebook', 'photo']
  ];
  for (const [url, platform, kind] of cases) {
    const result = parseSocialUrl(url);
    assert.equal(result?.platform, platform, url);
    assert.equal(result.kind, kind);
    assert.doesNotMatch(result.url, /tracking|igsh|fragment|private/);
  }
});

test('rejects spoofing, credentials, insecure schemes, ports, unsupported and shortened routes', () => {
  for (const url of [
    'https://instagram.com.evil.test/reel/a', 'https://evilinstagram.com/reel/a',
    'https://instagram.com@evil.test/reel/a', 'https://user:pass@instagram.com/reel/a',
    'http://instagram.com/reel/a', 'javascript:alert(1)', 'https://127.0.0.1/reel/a',
    'https://instagram.com:444/reel/a', 'https://instagram.com/stories/person/123',
    'https://instagram.com/reel/%2fadmin', 'https://instagram.com/reel/a\\b',
    'https://vm.tiktok.com/abcd', 'https://www.tiktok.com/t/abcd',
    'https://facebook.com/share/r/abc', 'https://facebook.com/groups/123/posts/456',
    'https://facebook.com/photo.php?fbid=not-an-id', 'https://instagram.com/direct/inbox'
  ]) assert.equal(parseSocialUrl(url), null, url);
});

test('extractor ignores opt-outs, spoilers, code, masked links; deduplicates and caps', () => {
  for (const content of [`<${ig}>`, `||${ig}||`, '`' + ig + '`', '```js\n' + ig + '\n```', `[hi](${ig})`]) {
    assert.deepEqual(extractLinks(content), [], content);
  }
  assert.equal(extractLinks(`(${ig}), ${ig}?utm_source=test`).length, 1);
  assert.equal(extractLinks([1, 2, 3, 4].map(n => `https://instagram.com/p/a${n}`).join(' ')).length, 3);
});

test('default cards disclose limitation and have no manufactured image or video', () => {
  const payload = buildPayload(ig, config.modes);
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].description, /not been verified/);
  assert.equal(payload.embeds[0].video, undefined);
  assert.deepEqual(payload.allowedMentions, { parse: [], repliedUser: false });
});

test('opt-in helpers rewrite deterministically and retain original fallback', () => {
  const payload = buildPayload(`${ig} https://tiktok.com/@p/photo/123?secret=x`, { instagram: 'oginstagram', tiktok: 'fxtiktok' });
  assert.match(payload.content, /https:\/\/oginstagram.com\/reel\/ABC_123/);
  assert.match(payload.content, /https:\/\/tnktok.com\/@p\/photo\/123/);
  assert.match(payload.content, /Original: <https:\/\/www.instagram.com/);
  assert.doesNotMatch(payload.content, /secret/);
  assert.deepEqual(payload.embeds, []);
  assert.equal(buildPayload(ig, { instagram: 'off' }), null);
  assert.equal(buildPayload(ig, { instagram: 'native' }).content, 'https://www.instagram.com/reel/ABC_123');
});

test('test isolation ignores foreign guilds/channels, bots, webhooks, system messages and suppression', async () => {
  let sends = 0;
  const handle = createHandler(config, { canSend: () => true });
  for (const overrides of [
    { guildId: null }, { guildId: 'foreign' }, { channelId: 'foreign' },
    { author: { bot: true } }, { webhookId: 'abc' }, { system: true },
    { flags: { has: () => true } }
  ]) await handle(message({ channel: { send: async () => { sends++; } }, ...overrides }));
  assert.equal(sends, 0);
});

test('permission failure does not send', async () => {
  const handle = createHandler(config, { canSend: () => false });
  await handle(message({ channel: { send: async () => assert.fail('unexpected send') } }));
});

test('concurrent duplicates and channel bursts are bounded; later messages work', async () => {
  let time = 10000;
  let sends = 0;
  const handle = createHandler(config, { canSend: () => true, now: () => time });
  const input = message({ channel: { send: async () => { sends++; } } });
  await Promise.all([handle(input), handle(input), handle({ ...input, id: '2' })]);
  assert.equal(sends, 1);
  time += 3001;
  await handle(input);
  assert.equal(sends, 1);
  await handle({ ...input, id: '3' });
  assert.equal(sends, 2);
});

test('API failures log only a static code, without message content or credentials', async () => {
  const logs = [];
  const handle = createHandler(config, { canSend: () => true, log: value => logs.push(value) });
  await handle(message({ channel: { send: async () => { throw new Error('TOKEN message body secret'); } } }));
  assert.deepEqual(logs, ['preview_send_failed']);
});

test('Facebook photos including mixed messages remain untouched without metadata requests',async()=>{
 let touched=0;
 const h=createHandler(config,{canSend:()=>true,repost:async()=>{touched++;},makeInstagramPayload:async()=>{touched++;},expandLinks:async()=>{touched++;}});
 await h(message({content:'Keep exactly https://www.facebook.com/photo?fbid=123&set=a.456 '+ig,channel:{send:async()=>{touched++;}}}));
 assert.equal(touched,0);
});
test('expanded preview lookup keeps exact original message text in custom response',async()=>{
 const original='  My text\nhttps://www.instagram.com/share/reel/ABC?utm_source=test';let sent;
 const h=createHandler(config,{canSend:()=>true,expandLinks:async()=>ig,makeInstagramPayload:async()=>({flags:32768,components:[{type:10,content:ig},{type:17,components:[]} ]})});
 await h(message({content:original,channel:{send:async p=>{sent=p;}}}));
 assert.equal(sent.components[0].content,original);
});

test('Clean YouTube is untouched and failed replacement never sends a companion',async()=>{
 let sends=0,reposts=0;const h=createHandler({...config,repostEnabled:true},{canSend:()=>true,repost:async()=>{reposts++;return false;},makeInstagramPayload:async()=>null});
 await h(message({content:'https://www.youtube.com/watch?v=aqz-KE-bpKQ',channel:{send:async()=>sends++}}));assert.equal(reposts,0);assert.equal(sends,0);
 await h(message({channel:{send:async()=>sends++}}));assert.equal(reposts,1);assert.equal(sends,0);
});

test('tracked YouTube is replaced with plain cleaned text and no custom preview',async()=>{
 let result;let sends=0;
 const h=createHandler({...config,repostEnabled:true},{canSend:()=>true,repost:async(m,p,text)=>{result={p,text};},expandLinks:async()=>{throw Error('No helper');}});
 await h(message({content:'My video https://youtu.be/aqz-KE-bpKQ?si=abc&t=12',channel:{send:async()=>sends++}}));
 assert.equal(result.text,'My video https://youtu.be/aqz-KE-bpKQ?t=12');
 assert.equal(result.p.components,undefined);assert.equal(result.p.embeds,undefined);assert.equal(sends,0);
});
