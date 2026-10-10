import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl} from '../src/previews.js';
import {simplePayload} from '../src/simple-cards.js';
test('Instagram username, legacy video and plural reel routes normalize to content URLs',()=>{
 for(const [input,out] of [['/nasa/p/ABC','/p/ABC'],['/nasa/reel/ABC','/reel/ABC'],['/tv/ABC','/p/ABC'],['/reels/ABC','/reel/ABC']])assert.equal(parseSocialUrl('https://www.instagram.com'+input).url,'https://www.instagram.com'+out);
 assert.equal(parseSocialUrl('https://www.instagram.com/nasa/p/ABC?img_index=2&utm_source=test').url,'https://www.instagram.com/p/ABC?img_index=2');
});
test('Instagram resource cards keep links without fetching private or unsupported resources',async()=>{
 for(const [path,kind] of [['/stories/nasa/123','story'],['/stories/highlights/123','highlight']]){
 const url='https://www.instagram.com'+path;assert.equal(parseSocialUrl(url).kind,kind);
 const p=await simplePayload(url,{instagram:'oginstagram'},[],async()=>{throw Error('must not fetch');});assert.ok(p);assert.match(JSON.stringify(p),/preview unavailable/);assert.ok(!JSON.stringify(p).includes('Open the linked title'));
 }
 for(const path of ['/stories/nasa/','/reels/audio/123','/accounts/login','/direct/inbox','/challenge','/stories/nasa/no-id','/reels/audio/no-id'])assert.equal(parseSocialUrl('https://www.instagram.com'+path),null);
});

import {parseInstagramCard} from '../src/instagram-card.js';
test('public profile media is accepted only for the matching account',()=>{
 const link=parseSocialUrl('https://www.instagram.com/nasa');
 const html=url=>`<script id="discord:component-embed">${JSON.stringify({component:{type:17,components:[{type:9,components:[{type:10,content:'**NASA**\n[@nasa](https://www.instagram.com/nasa/)\n\nFollower counts'}]},{type:12,items:[{media:{url}}]}]}})}</script>`;
 const good=parseInstagramCard(html('https://oginstagram.com/offload/@nasa/1?v=2'),link);
 assert.ok(good);assert.match(JSON.stringify(good),/NASA/);assert.ok(!JSON.stringify(good).includes('Follower counts'));
 for(const u of ['https://oginstagram.com/offload/@other/1','https://evil.test/offload/@nasa/1','https://oginstagram.com/offload/@nasa/1/extra'])assert.equal(parseInstagramCard(html(u),link),null);
});
