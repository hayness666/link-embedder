import test from 'node:test';import assert from 'node:assert/strict';
import {withCardControls} from '../../src/card-controls.js';
import {simpleCard} from '../../src/simple-cards.js';import {parseSocialUrl} from '../../src/previews.js';
import {spoilerComponents,createManagementHandler} from '../../src/manage-post.js';
import {buildEditedPost} from '../../src/edit-post.js';
const urls=['https://www.amazon.com/dp/B08KTZ8249','https://bsky.app/profile/example.com/post/abc123','https://www.facebook.com/reel/123','https://www.instagram.com/p/Abc123','https://www.pinterest.com/pin/123/','https://www.reddit.com/r/test/comments/abc123/test','https://www.snapchat.com/spotlight/ABCDEFGHIJKLMNOPQRSTUVWXYZ','https://www.threads.com/@test/post/Abc123','https://www.tiktok.com/@test/video/123','https://twitter.com/test/status/123','https://upscrolled.com/@test/5ec53de0-fd6e-11f0-8080-8001278c05c2'];
test('all supported card families receive the same title control without losing content',()=>{
 for(const url of urls){const link=parseSocialUrl(url);assert.ok(link,url);const card=simpleCard(link,{name:'Name',username:'handle',caption:'Caption',media:[]});const old=structuredClone(card),result=withCardControls([card]);assert.equal(result[0].components[0].type,9);assert.equal(result[0].components[0].accessory.label,'⋯');assert.equal(result[0].components[0].accessory.style,2);assert.deepEqual(result[0].components.slice(1),old.components.slice(1));assert.deepEqual(card,old);assert.deepEqual(withCardControls(result),result);}
});
test('multiple cards use distinct IDs; galleries, quotes, spoilers, and placeholders survive',()=>{
 const card={type:17,components:[{type:10,content:'Title'},{type:10,content:'> quote'},{type:12,items:[{media:{url:'https://example.org/photo.jpg'}}]},{type:10,content:'Preview unavailable.'}]};
 const p=withCardControls([{type:10,content:'source'},card,card]);assert.equal(p[1].components[0].accessory.custom_id,'manage:open:0');assert.equal(p[2].components[0].accessory.custom_id,'manage:open:1');const hidden=spoilerComponents(p);assert.equal(hidden[1].components[2].items[0].spoiler,true);assert.equal(hidden[1].components[0].accessory.custom_id,'manage:open:0');
});
test('component overflow fails before sending',()=>{assert.throws(()=>withCardControls(Array.from({length:14},()=>({type:17,components:[{type:10,content:'title'}]}))),/limit/);});
test('text edits and changed-link rebuild retain controls',async()=>{
 const url='https://www.instagram.com/p/Abc123',card={type:17,components:[{type:10,content:'Title'},{type:12,items:[{media:{url:'https://example.org/photo.jpg'},spoiler:true}]}]},current={components:[{type:10,content:url},...withCardControls([card])],attachments:new Map()};
 const p=await buildEditedPost(current,'hello '+url,{modes:{instagram:'oginstagram'}});assert.equal(p.components[1].components[0].accessory.label,'⋯');
 const q=await buildEditedPost(current,'https://www.instagram.com/p/Def456',{modes:{instagram:'oginstagram'}},{expand:async x=>x,render:async()=>({flags:32768,components:[{type:10,content:'source'},card]})});assert.equal(q.components[1].components[0].accessory.label,'⋯');assert.equal(q.components[1].components[1].items[0].spoiler,true);
});
test('menu targets actual message, checks scope/application, and preserves owner permissions',async()=>{
 const id='111111111111111111',row={ownerId:'owner',guildId:'guild',channelId:'channel',webhookId:'hook'};
 for(const mode of ['owner','other','wrong-channel','wrong-hook','wrong-app','no-record']){let reply;const i={isButton:()=>true,customId:'manage:open:0',message:{id,webhookId:mode==='wrong-hook'?'bad':'hook'},user:{id:mode==='other'?'other':'owner'},guildId:'guild',channelId:mode==='wrong-channel'?'bad':'channel',client:{user:{id:'bot'}},channel:{messages:{fetch:async()=>({id,webhookId:'hook',components:[]})},fetchWebhooks:async()=>[{id:'hook',owner:{id:'bot'},applicationId:mode==='wrong-app'?'bad':'bot'}]},reply:async p=>{reply=p;}};await createManagementHandler({get:key=>key===id&&mode!=='no-record'?row:null},{channelIds:new Set()})(i);assert.equal(reply.flags,64);if(mode==='owner'){assert.equal(reply.content,undefined);assert.equal(reply.components[0].components[0].style,3);}else if(mode==='other')assert.deepEqual(reply.components[0].components.map(c=>c.label),['Mark NSFW']);else assert.equal(reply.components,undefined);}
});
