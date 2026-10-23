import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload,extractLinks} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {shortFamily,resolveShortLink} from '../../src/short-links.js';
import {readConfig} from '../../src/config.js';
import {brands} from '../../src/platform-brands.js';
test('removed LinkedIn post and short links stay untouched without requests',async()=>{
 let calls=0;const fetcher=()=>{calls++;throw Error('Unexpected request');};
 for(const base of ['https://linkedin.com/posts/example-123','https://www.linkedin.com/feed/update/urn:li:activity:123','https://linkedin.com/messaging/thread/123','https://lnkd.in/example']){
  const raw=base+'?utm_source=qa&trk=example#fragment';
  assert.equal(parseSocialUrl(raw),null);assert.deepEqual(extractLinks(raw),[]);
  assert.equal(shortFamily(raw),null);assert.equal(await resolveShortLink(raw,fetcher),null);
  assert.equal(cleanCardLinks('Before '+raw+' after'),'Before '+raw+' after');
  for(const mode of ['card','native']){
   assert.equal(readConfig({LINKEDIN_MODE:mode}).modes.linkedin,undefined);
   assert.equal(buildPayload(raw,{linkedin:mode}),null);
   assert.equal(await simplePayload(raw,{linkedin:mode},[{url:raw,title:'Native preview'}],fetcher),null);
  }
 }
 assert.equal(calls,0);assert.equal(brands.linkedin,undefined);
});
