import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../../src/config.js';
import {parseSocialUrl,buildPayload} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {shortFamily,expandShortLinks} from '../../src/short-links.js';
import {createHandler} from '../../src/handler.js';
import {simplePayload} from '../../src/simple-cards.js';
test('all formerly supported YouTube routes stay untouched without helper requests',async()=>{
 const config=readConfig({PROVIDER_SHARING_APPROVED:'yes',YOUTUBE_MODE:'native',REPOST_AS_AUTHOR:'yes'});
 assert.equal(config.modes.youtube,undefined);
 for(const url of ['https://www.youtube.com/watch?v=aqz-KE-bpKQ&utm_source=share','https://youtube.com/shorts/aqz-KE-bpKQ?si=test','https://youtu.be/aqz-KE-bpKQ?t=12&si=test','https://m.youtube.com/watch?v=aqz-KE-bpKQ','https://www.youtube.com/@channel','https://www.youtube.com/playlist?list=PLtest']){
  assert.equal(parseSocialUrl(url),null);assert.equal(shortFamily(url),null);assert.equal(buildPayload(url,config.modes),null);assert.equal(cleanCardLinks(url),url);
  assert.equal(await expandShortLinks(url,config.modes,()=>assert.fail('No redirect request')),url);
  assert.equal(await simplePayload(url,config.modes,[],()=>assert.fail('No helper fetch')),null);
  const handler=createHandler(config,{canSend:()=>true,repost:()=>assert.fail('No repost'),expandLinks:()=>assert.fail('No lookup')});
  await handler({id:'1',guildId:'1',channelId:'2',author:{bot:false},content:url,channel:{send:()=>assert.fail('No reply')}});
 }
});
