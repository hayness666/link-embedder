import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl,buildPayload} from '../../src/previews.js';
import {cleanCardLinks} from '../../src/repost.js';
import {simplePayload} from '../../src/simple-cards.js';
import {createHandler} from '../../src/handler.js';
import {readConfig} from '../../src/config.js';
test('removed Streamable routes remain untouched even with legacy configuration',async()=>{
 const modes={streamable:'card'};
 for(const url of ['https://streamable.com/abc123?utm_source=qa','https://www.streamable.com/abc123','https://streamable.com/e/abc123']){
 assert.equal(parseSocialUrl(url),null);assert.equal(buildPayload(url,modes),null);assert.equal(cleanCardLinks(url),url);
 assert.equal(await simplePayload(url,modes,[],()=>assert.fail('No fetch')),null);
 const handle=createHandler({...readConfig({}),modes,repostEnabled:true},{canSend:()=>true,repost:()=>assert.fail('No repost')});
 await handle({id:'1',guildId:'g',channelId:'c',content:url,author:{bot:false}});
 }
});
