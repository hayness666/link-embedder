import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload,extractLinks} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {shortFamily,resolveShortLink} from '../../src/short-links.js';
import {readConfig} from '../../src/config.js';
import {brands} from '../../src/platform-brands.js';
test('removed RedNote canonical and share links remain untouched without requests',async()=>{
 const urls=['https://www.xiaohongshu.com/explore/abc123','https://xiaohongshu.com/discovery/item/abc123','https://www.rednote.com/explore/abc123','https://rednote.com/discovery/item/abc123','https://xhslink.com/a/abc','https://xhslink.com/abc'];
 let calls=0;const fetcher=()=>{calls++;throw Error('Unexpected request');};
 for(const base of urls){
  const raw=base+'?xsec_token=example&utm_source=qa#fragment';
  assert.equal(parseSocialUrl(raw),null);assert.deepEqual(extractLinks(raw),[]);
  assert.equal(shortFamily(raw),null);assert.equal(await resolveShortLink(raw,fetcher),null);
  assert.equal(cleanCardLinks('Before '+raw+' after'),'Before '+raw+' after');
  for(const mode of ['card','native']){
   assert.equal(buildPayload(raw,{rednote:mode}),null);
   assert.equal(await simplePayload(raw,{rednote:mode},[{url:raw,title:'Native preview'}],fetcher),null);
  }
 }
 assert.equal(calls,0);assert.equal(readConfig({}).modes.rednote,undefined);assert.equal(brands.rednote,undefined);
});
