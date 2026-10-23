import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload,extractLinks} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {shortFamily,resolveShortLink} from '../../src/short-links.js';
import {readConfig} from '../../src/config.js';
import {brands} from '../../src/platform-brands.js';
test('removed Netflix post and short links stay untouched without requests',async()=>{
 let calls=0;const fetcher=()=>{calls++;throw Error('Unexpected request');};
 for(const base of ['https://www.netflix.com/title/81975622','https://netflix.com/watch/26797528','https://www.netflix.com/en-US/title/80057281','https://m.netflix.com/watch/26797528']){
  const raw=base+'?utm_source=qa&trk=example#fragment';
  assert.equal(parseSocialUrl(raw),null);assert.deepEqual(extractLinks(raw),[]);
  assert.equal(shortFamily(raw),null);assert.equal(await resolveShortLink(raw,fetcher),null);
  assert.equal(cleanCardLinks('Before '+raw+' after'),'Before '+raw+' after');
  for(const mode of ['card','native']){
   assert.equal(readConfig({NETFLIX_MODE:mode}).modes.netflix,undefined);
   assert.equal(buildPayload(raw,{netflix:mode}),null);
   assert.equal(await simplePayload(raw,{netflix:mode},[{url:raw,title:'Native preview'}],fetcher),null);
  }
 }
 assert.equal(calls,0);assert.equal(brands.netflix,undefined);
});
