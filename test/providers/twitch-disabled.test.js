import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig} from '../../src/config.js';
import {parseSocialUrl,buildPayload} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {createHandler} from '../../src/handler.js';
import {simplePayload} from '../../src/simple-cards.js';
const urls=['https://clips.twitch.tv/Clip-123?utm_source=share','https://www.twitch.tv/person/clip/Clip-123?utm_medium=app','https://www.twitch.tv/person','https://www.twitch.tv/videos/12345'];
test('Twitch clips, channels and VODs stay untouched even with old helper configuration',async()=>{
 const config=readConfig({PROVIDER_SHARING_APPROVED:'yes',TWITCH_MODE:'fxtwitch',REPOST_AS_AUTHOR:'yes'});
 assert.equal(config.modes.twitch,undefined);
 for(const url of urls){
  assert.equal(parseSocialUrl(url),null);assert.equal(buildPayload(url,config.modes),null);assert.equal(cleanCardLinks(url),url);
  assert.equal(await simplePayload(url,config.modes,[],()=>assert.fail('No Twitch fetch')),null);
  const handler=createHandler(config,{canSend:()=>true,repost:()=>assert.fail('No repost'),expandLinks:()=>assert.fail('No lookup'),makeCardPayload:()=>assert.fail('No preview')});
  await handler({id:'1',guildId:'1',channelId:'2',author:{bot:false},content:url,channel:{send:()=>assert.fail('No reply')}});
 }
});
