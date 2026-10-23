import test from 'node:test';
import assert from 'node:assert/strict';
import {snapchatAttachment} from '../../src/providers/snapchat.js';
import {simplePayload} from '../../src/simple-cards.js';
import {buildRepostPayload} from '../../src/repost.js';
const media='https://bolt-gcdn.sc-cdn.net/u/public?mo=sample';
const mp4=Buffer.from('000000186674797069736f6d0000020069736f6d6d703431','hex');
const response=()=>new Response(mp4,{headers:{'content-type':'application/octet-stream'}});
test('downloads bounded MP4 and rejects unsafe hosts redirects and invalid bytes',async()=>{
 assert.deepEqual(await snapchatAttachment(media,async(u,o)=>{assert.equal(o.redirect,'error');assert.ok(o.signal);return response();}),mp4);
 for(const u of ['http://bolt-gcdn.sc-cdn.net/u/a','https://bolt-gcdn.sc-cdn.net.evil.test/u/a','https://user@bolt-gcdn.sc-cdn.net/u/a','https://bolt-gcdn.sc-cdn.net/other'])assert.equal(await snapchatAttachment(u,()=>assert.fail('No fetch')),null);
 for(const res of [new Response('',{status:302}),new Response('<html>blocked</html>',{headers:{'content-type':'video/mp4'}}),new Response(mp4,{headers:{'content-type':'text/html'}}),new Response(mp4,{headers:{'content-length':'99999999','content-type':'video/mp4'}})])assert.equal(await snapchatAttachment(media,async()=>res),null);
 assert.equal(await snapchatAttachment(media,async()=>{throw Error('timeout');}),null);
 assert.equal(await snapchatAttachment(media,async()=>response(),{remaining:4}),null);
 const budget={remaining:mp4.length};assert.ok(await snapchatAttachment(media,async()=>response(),budget));assert.equal(await snapchatAttachment(media,async()=>response(),budget),null);
});
test('Spotlight custom card uploads named MP4 and preserves it through repost payload',async()=>{
 const url='https://www.snapchat.com/@example/spotlight/'+'A'.repeat(24);
 const html=`<meta property="og:url" content="${url}"><meta property="og:title" content="Video | Example (@example) | Snapchat"><meta property="og:video:type" content="video/mp4"><meta property="og:video" content="${media}">`;
 const p=await simplePayload(url,{snapchat:'card'},[],async u=>u===url?new Response(html,{headers:{'content-type':'text/html'}}):response());
 assert.equal(p.files[0].name,'spotlight-0.mp4');assert.equal(p.files[0].contentType,'video/mp4');assert.deepEqual(p.files[0].attachment,mp4);
 assert.match(JSON.stringify(p.components),/attachment:\/\/spotlight-0.mp4/);
 const repost=buildRepostPayload({content:url,author:{username:'Example'}},p);assert.equal(repost.files,p.files);
 const failed=await simplePayload(url,{snapchat:'card'},[],async u=>u===url?new Response(html,{headers:{'content-type':'text/html'}}):new Response('',{status:403}));
 assert.equal(failed.files,undefined);assert.doesNotMatch(JSON.stringify(failed.components),/attachment:\/\//);
});
