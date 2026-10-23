import test from 'node:test';
import assert from 'node:assert/strict';
import {simplePayload,metadataFromHtml} from '../../src/simple-cards.js';
import {parseSocialUrl} from '../../src/previews.js';
const url='https://www.snapchat.com/@rmz_clips/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYdGVtcG1ocGNvAZiLpYoSAZiLpYoCAAAAAQ';
const html=`<meta property="og:url" content="${url}"><meta property="og:title" content="123 likes | Aww | Rmz _clips (@rmz_clips) | Posted yesterday | Spotlight"><meta property="og:description" content="A red panda."><meta property="og:video:type" content="video/mp4"><meta property="og:video" content="https://bolt-gcdn.sc-cdn.net/u/example?mo=signed&amp;uc=46">`;
test('public Spotlight becomes actual MP4 media in shared card with accurate author',async()=>{
 assert.equal(parseSocialUrl(url+'?utm_source=qa').url,url);
 const payload=await simplePayload(url,{snapchat:'card'},[],async u=>u===url ? new Response(html,{headers:{'content-type':'text/html'}}) : new Response(Buffer.from('000000186674797069736f6d0000020069736f6d6d703431','hex'),{headers:{'content-type':'video/mp4'}}));
 const card=payload.components[1];assert.equal(card.accent_color,0xfffc00);assert.equal(card.components.find(c=>c.type===12).items[0].media.url,'attachment://spotlight-0.mp4');
 assert.ok(card.components.some(c=>c.content?.split('\n')[1]?.startsWith('**Rmz ')));
 assert.ok(card.components.some(c=>c.content === '<:snapchat:1558173235592429760>\u00a0\u00a0**Snapchat** via [Link Embedder](<https://discord.com/users/1557858203897823304>)'));assert.ok(!JSON.stringify(card).includes('123 likes'));
 for(const bad of [html.replace('bolt-gcdn.sc-cdn.net','evil.test'),html.replace('video/mp4','text/html'),html.replace(url,url+'other')])assert.equal(metadataFromHtml(bad,'snapchat',url),null);
});
