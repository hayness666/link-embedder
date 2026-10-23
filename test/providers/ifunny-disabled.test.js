import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {createHandler} from '../../src/handler.js';
import {readConfig} from '../../src/config.js';
test('removed iFunny routes remain untouched even with legacy configuration',async()=>{
 assert.equal(readConfig({IFUNNY_MODE:'embedez',PROVIDER_SHARING_APPROVED:'yes'}).modes.ifunny,undefined);
 const modes={ifunny:'embedez'};
 for(const url of ['https://ifunny.co/video/ABC?utm_source=qa','https://www.ifunny.co/picture/ABC','https://ifunny.co/gif/ABC','https://ifunny.co/meme/ABC','https://ifunnyez.co/video/ABC']){
 assert.equal(parseSocialUrl(url),null);assert.equal(buildPayload(url,modes),null);assert.equal(cleanCardLinks(url),url);
 assert.equal(await simplePayload(url,modes,[],()=>assert.fail('No fetch')),null);
 const handle=createHandler({...readConfig({}),modes,repostEnabled:true},{canSend:()=>true,repost:()=>assert.fail('No repost')});
 await handle({id:'1',guildId:'g',channelId:'c',content:url,author:{bot:false}});
 }
});
