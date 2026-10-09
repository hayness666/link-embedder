import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackPayload, checkFallback } from '../src/native-fallback.js';
const url = 'https://oginstagram.com/reel/ABC';
const original = 'https://www.instagram.com/reel/ABC';
const payload = {content: `Look ${url}`, embeds: []};
test('missing and error-only helper embeds fall back to native source exactly once', () => {
  assert.equal(fallbackPayload(payload).content, `Look ${original}`);
  assert.equal(fallbackPayload(payload,[{url,title:'Error'}]).content,`Look ${original}`);
  assert.equal(fallbackPayload({content:`${url}\nOriginal: <${original}>`}).content, original);
});
test('working media prevents fallback even when Discord rewrites its source URL', () => {
  for (const type of ['image','video']) assert.equal(fallbackPayload(payload,[{url:original,[type]:{url:'https://cdn.example/media'}}]),null);
  assert.equal(fallbackPayload(payload,[{url:'https://oginstagram.com/offload/ABC/1',video:{url:'https://cdn.example/media'}}]),null);
  assert.equal(fallbackPayload(payload,[{image:{url:'https://cdn.example/image'}}]),null);
});
test('native and unrecognized URLs never trigger helper fallback', () => {
  assert.equal(fallbackPayload({content:original}),null);
  assert.equal(fallbackPayload({content:'https://oginstagram.com.evil.test/reel/ABC'}),null);
});
test('fallback edits once without new posts; moderator edits and failed fetch are preserved', async () => {
  const updates=[];const edit=async p=>updates.push(p);
  await checkFallback(payload,async()=>({...payload,embeds:[]}),edit);
  assert.equal(updates.length,1);assert.deepEqual(updates[0].allowedMentions.parse,[]);
  await checkFallback(payload,async()=>({content:'edited',embeds:[]}),edit);
  await checkFallback(payload,async()=>{throw Error('not found');},edit);
  assert.equal(updates.length,1);
});
