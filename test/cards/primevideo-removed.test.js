import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload,extractLinks} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {shortFamily,resolveShortLink} from '../../src/short-links.js';
import {readConfig} from '../../src/config.js';
import {brands} from '../../src/platform-brands.js';
test('removed Prime Video post and short links stay untouched without requests',async()=>{
 let calls=0;const fetcher=()=>{calls++;throw Error('Unexpected request');};
 for(const base of ['https://www.primevideo.com/detail/0OBDS97ED82GWIQB4ICY88JTFF','https://primevideo.com/region/na/detail/Title/0OBDS97ED82GWIQB4ICY88JTFF','https://www.primevideo.com/region/na/storefront/merch/IncludedwithPrime']){
  const raw=base+'?utm_source=qa&trk=example#fragment';
  assert.equal(parseSocialUrl(raw),null);assert.deepEqual(extractLinks(raw),[]);
  assert.equal(shortFamily(raw),null);assert.equal(await resolveShortLink(raw,fetcher),null);
  assert.equal(cleanCardLinks('Before '+raw+' after'),'Before '+raw+' after');
  for(const mode of ['card','native']){
   assert.equal(readConfig({PRIMEVIDEO_MODE:mode}).modes.primevideo,undefined);
   assert.equal(buildPayload(raw,{primevideo:mode}),null);
   assert.equal(await simplePayload(raw,{primevideo:mode},[{url:raw,title:'Native preview'}],fetcher),null);
  }
 }
 assert.equal(calls,0);assert.equal(brands.primevideo,undefined);
});

test('Amazon product routes and matching product images remain supported',async()=>{
 const url='https://www.amazon.com/dp/B08KTZ8249';
 assert.equal(parseSocialUrl(url+'?tag=example&utm_source=qa').platform,'amazon');
 const image='https://m.media-amazon.com/images/product.jpg';
 const payload=await simplePayload(url,{amazon:'card'},[{url,title:'Kindle Paperwhite',description:'Product description',image:{url:image}}],async()=>{throw Error('Offline metadata test');});
 assert.ok(JSON.stringify(payload).includes('Kindle Paperwhite'));
 assert.ok(JSON.stringify(payload).includes(image));
});
