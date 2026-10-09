import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInstagramCard, instagramPayload, shortCaption, cardHeading } from '../src/instagram-card.js';
import { buildRepostPayload } from '../src/repost.js';
const link = { url: 'https://www.instagram.com/reel/ABC', platform: 'instagram' };
const document = (media = 'https://oginstagram.com/offload/ABC/1?v=2') => `<script id="discord:component-embed" type="application/json">${JSON.stringify({component:{type:17,components:[
  {type:9,components:[{type:10,content:'**Name**\n[@person](https://www.instagram.com/person/)\n\n❤️ **42** 💬 **5**'}],accessory:{type:11}},
  {type:10,content:'Caption [#hello](https://www.instagram.com/tags/hello/) @everyone'},
  {type:12,items:[{media:{url:media}}]},
  {type:9,components:[{type:10,content:'OGInstagram date'}],accessory:{type:2}}
]}})}</script>`;
test('custom Instagram card puts plain caption after media and removes provider decoration', () => {
  const card = parseInstagramCard(document(), link);
  assert.deepEqual(card.components.map(c=>c.type), [10,10,12,10,10]);
  assert.equal(card.components[4].content, '<:instagramlogo:1558170063251574895>\u00a0\u00a0**Instagram** via <@1557858203897823304>');
  assert.equal(card.components[1].content, '**Name** @\u200bperson');
  const json = JSON.stringify(card);
  assert.doesNotMatch(json, /❤️|💬|date/);
  assert.match(card.components[3].content, /#hello/);
  assert.doesNotMatch(card.components[3].content, /@everyone/);
});
test('rejects media outside same-post HTTPS helper offload URLs', () => {
  for (const url of ['http://oginstagram.com/offload/ABC/1', 'https://evil.test/a',
    'https://oginstagram.com/offload/OTHER/1','https://oginstagram.com/offload/ABC/avatar',
    'https://x@oginstagram.com/offload/ABC/1','https://oginstagram.com:444/offload/ABC/1']) {
    assert.equal(parseInstagramCard(document(url), link), null);
  }
  assert.equal(parseInstagramCard('<html>Error</html>', link), null);
});
test('request requires approval, is bounded, rejects HTTP errors, and does not follow redirects', async () => {
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, 'https://oginstagram.com/reel/ABC?e=c');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    return new Response(document(), {headers:{'content-type':'text/html'}});
  };
  assert.equal(await instagramPayload(link.url,{instagram:'card'},fetcher), null);
  assert.equal(calls,0);
  const payload = await instagramPayload(link.url,{instagram:'oginstagram'},fetcher);
  assert.equal(payload.flags,32768);
  assert.equal(payload.embeds,undefined);
  for (const response of [new Response('error',{status:503}),new Response('x'.repeat(262145),{headers:{'content-type':'text/html'}})]) {
    assert.equal(await instagramPayload(link.url,{instagram:'oginstagram'},async()=>response),null);
  }
});
test('component repost retains source once, disables mentions and supplies webhook component option', async () => {
  const preview = await instagramPayload(link.url,{instagram:'oginstagram'},async()=>new Response(document(),{headers:{'content-type':'text/html'}}));
  const content = 'Hello '+link.url;
  const result = buildRepostPayload({content,author:{username:'Person'}}, preview);
  assert.equal(result.content,undefined);
  assert.equal(result.embeds,undefined);
  assert.equal(result.components[0].content,content);
  assert.equal(result.withComponents,true);
  assert.deepEqual(result.allowedMentions,{parse:[],repliedUser:false});
});

test('caption limit is 250 characters including ellipsis', () => {
  assert.equal(shortCaption('a'.repeat(250)), 'a'.repeat(250));
  assert.equal(shortCaption('a'.repeat(251)), 'a'.repeat(249)+'…');
  assert.equal(shortCaption('hello [#tag](https://instagram.com/tags/tag/)'), 'hello #tag');
});

test('normalizes stylized hashtag characters', () => {
  assert.equal(shortCaption('#sɪɴɢᴇʀsᴏɴɢᴡʀɪᴛᴇʀ #ｍｕｓｉｃ'), '#singersongwriter #music');
});

test('headings use trusted original URLs and distinguish reels from posts',()=>{
 assert.equal(cardHeading({platform:'instagram',url:'https://www.instagram.com/reel/ABC'}),'### [Instagram Reel ↗](<https://www.instagram.com/reel/ABC>)');
 assert.match(cardHeading({platform:'instagram',url:'https://www.instagram.com/p/ABC'}),/Instagram Post ↗/);
 assert.match(cardHeading({platform:'twitter',url:'https://twitter.com/test/status/123'}),/Tweet on Twitter ↗/);
 assert.equal(cardHeading({platform:'twitter',url:'https://evil.test/'}),'');
 assert.ok(!cardHeading({platform:'medal',url:'https://medal.tv/games/game/clips/abc'},'[bad](https://evil.test)').includes('[bad]'));
});
