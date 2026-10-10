import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl} from '../src/previews.js';
import {simplePayload} from '../src/simple-cards.js';
test('Instagram username, legacy video and plural reel routes normalize to content URLs',()=>{
 for(const [input,out] of [['/nasa/p/ABC','/p/ABC'],['/nasa/reel/ABC','/reel/ABC'],['/tv/ABC','/p/ABC'],['/reels/ABC','/reel/ABC']])assert.equal(parseSocialUrl('https://www.instagram.com'+input).url,'https://www.instagram.com'+out);
 assert.equal(parseSocialUrl('https://www.instagram.com/nasa/p/ABC?img_index=2&utm_source=test').url,'https://www.instagram.com/p/ABC?img_index=2');
});
test('Instagram resource cards keep links without fetching private or unsupported resources',async()=>{
 for(const [path,kind] of [['/nasa/','profile'],['/stories/nasa/','story'],['/stories/nasa/123','story'],['/stories/highlights/123','highlight'],['/reels/audio/123','audio']]){
 const url='https://www.instagram.com'+path;assert.equal(parseSocialUrl(url).kind,kind);
 const p=await simplePayload(url,{instagram:'oginstagram'},[],async()=>{throw Error('must not fetch');});assert.ok(p);assert.match(JSON.stringify(p),/preview unavailable/);assert.ok(!JSON.stringify(p).includes('Open the linked title'));
 }
 for(const path of ['/accounts/login','/direct/inbox','/challenge','/stories/nasa/no-id','/reels/audio/no-id'])assert.equal(parseSocialUrl('https://www.instagram.com'+path),null);
});
