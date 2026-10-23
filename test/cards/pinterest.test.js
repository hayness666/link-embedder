import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSocialUrl} from '../../src/previews.js';
import {simplePayload,metadataFromHtml,validMedia} from '../../src/simple-cards.js';
import {buildRepostPayload} from '../../src/repost.js';
const url='https://www.pinterest.com/pin/155303888141933052/';
const image='https://i.pinimg.com/originals/ab/cd/ef/example.jpg';
test('Pinterest canonical pins reject unrelated routes and media hosts',()=>{
 assert.equal(parseSocialUrl(url+'?UTM_SOURCE=qa').url,url);
 for(const u of ['https://pin.it/a','https://pinterest.com/user/','https://pinterest.com.evil.test/pin/123/'])assert.equal(parseSocialUrl(u),null);
 assert.equal(validMedia(image,'pinterest'),true);assert.equal(validMedia('https://i.pinimg.com.evil.test/a.jpg','pinterest'),false);
 assert.equal(metadataFromHtml('<meta property="og:url" content="https://www.pinterest.com/pin/12/">','pinterest',url),null);
});
test('Pinterest exact native metadata produces shared large-image card and clean source',async()=>{
 const content='My words '+url+'?utm_source=qa';
 const payload=await simplePayload(content,{pinterest:'card'},[{url,title:'Blue art',author:{name:'Etsy'},description:'Caption',image:{url:image}}],async()=>new Response('',{status:401}));
 const card=payload.components[1];assert.equal(card.accent_color,0xe60023);
 assert.equal(card.components.find(c=>c.type===12).items[0].media.url,image);
 assert.ok(card.components.some(c=>c.content==='**Etsy**'));
 assert.ok(card.components.at(-1).content.includes('**Pinterest** via'));
 const repost=buildRepostPayload({content,author:{username:'Person'}},payload);
 assert.equal(repost.components[0].content,'My words '+url);
 const unrelated=await simplePayload(url,{pinterest:'card'},[{url:'https://www.pinterest.com/pin/12/',image:{url:image}}],async()=>new Response('',{status:403}));
 assert.equal(unrelated.components[1].components.some(c=>c.type===12),false);
});

import {createHandler} from '../../src/handler.js';
import {readConfig} from '../../src/config.js';
test('Pinterest waits past unrelated and title-only embeds for matching thumbnail',async()=>{
 const content='Keep my words '+url+'?UTM_CONTENT=share&ref=mobile';
 const base={id:'p1',guildId:'g1',channelId:'c1',author:{username:'Person'},content,embeds:[{url:'https://www.pinterest.com/pin/12/',thumbnail:{url:image}}]};
 let fetches=0,result;
 base.channel={messages:{fetch:async()=>({...base,embeds:[{url:'https://pinterest.com/pin/155303888141933052?utm_source=native',title:'Blue art',author:{name:'Etsy'},description:'A blue picture',...(++fetches===2?{image:{url:'https://evil.test/a'},thumbnail:{url:image}}:{})}]})}};
 const handler=createHandler({...readConfig({}),repostEnabled:true},{canSend:()=>true,expandLinks:async text=>text,
 makeCardPayload:(text,modes,embeds)=>simplePayload(text,modes,embeds,async()=>new Response('',{status:403})),
 repost:async(message,payload,display)=>{result=buildRepostPayload(message,payload,display);return true;}});
 await handler(base);
 assert.equal(fetches,2);
 assert.equal(result.components[0].content,'Keep my words '+url);
 const card=result.components[1];assert.equal(card.components.find(c=>c.type===12).items[0].media.url,image);
 assert.ok(card.components.some(c=>c.content==='**Etsy**'));
 assert.ok(card.components.some(c=>c.content==='A blue picture'));
 assert.ok(card.components[0].content.includes('[Blue art]'));
});
test('Pinterest bounded HTML rejects oversized response and accepts matching public metadata',async()=>{
 const html=`<meta property="og:url" content="${url}"><meta property="og:title" content="Blue art"><meta property="og:image" content="${image}">`;
 const good=await simplePayload(url,{pinterest:'card'},[],async(_,options)=>{
 assert.equal(options.redirect,'error');assert.ok(options.signal);return new Response(html,{headers:{'content-type':'text/html'}});
 });
 assert.ok(good.components[1].components.some(c=>c.type===12));
 const oversized=await simplePayload(url,{pinterest:'card'},[],async()=>new Response(html+' '.repeat(524288),{headers:{'content-type':'text/html'}}));
 assert.equal(oversized.components[1].components.some(c=>c.type===12),false);
});

test('Pinterest uses only a validated author profile for linked plain handle',async()=>{
 for(const [profile,expected] of [['https://www.pinterest.com/hmaglicic/',true],['https://pinterest.com.evil.test/hmaglicic/',false],['https://www.pinterest.com/pin/12/',false],[undefined,false]]){
 const payload=await simplePayload(url,{pinterest:'card'},[{url,title:'Art',author:{name:'heather maglicic',url:profile},image:{url:image}}],async()=>new Response('',{status:403}));
 const text=JSON.stringify(payload);assert.equal(text.includes('[@hmaglicic](<https://www.pinterest.com/hmaglicic/>)'),expected);
 assert.ok(text.includes('**heather maglicic**'));
 }
});
