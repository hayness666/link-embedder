import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload,extractLinks} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {shortFamily,resolveShortLink} from '../../src/short-links.js';
import {readConfig} from '../../src/config.js';
import {brands} from '../../src/platform-brands.js';
test('removed Mastodon and independent federation URLs remain untouched without requests',async()=>{
 let calls=0;const fetcher=()=>{calls++;throw Error('Unexpected request');};
 for(const host of ['mastodon.social','mastodon.online','social.example.org']) for(const path of ['/@person/123','/users/person/statuses/123']){
  const raw=`https://${host}${path}?utm_source=qa#fragment`;
  assert.equal(parseSocialUrl(raw),null);assert.deepEqual(extractLinks(raw),[]);
  assert.equal(shortFamily(raw),null);assert.equal(await resolveShortLink(raw,fetcher),null);
  assert.equal(cleanCardLinks('Before '+raw+' after'),'Before '+raw+' after');
  for(const mode of ['card','native','fxmastodon']){
   assert.equal(readConfig({MASTODON_MODE:mode,PROVIDER_SHARING_APPROVED:'yes'}).modes.mastodon,undefined);
   assert.equal(buildPayload(raw,{mastodon:mode}),null);
   assert.equal(await simplePayload(raw,{mastodon:mode},[{url:raw,title:'Native preview'}],fetcher),null);
  }
 }
 assert.equal(calls,0);assert.equal(brands.mastodon,undefined);
});
