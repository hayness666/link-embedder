import test from 'node:test';
import assert from 'node:assert/strict';
import {expandShortLinks,amazonShareContext} from '../../src/short-links.js';
import {simplePayload} from '../../src/simple-cards.js';
import {buildRepostPayload} from '../../src/repost.js';
const target='https://www.amazon.com/dp/B08KTZ8249';
const source='https://amzn.to/46r7XV5?ltclid=&utm_source=share&UTM_CONTENT=test';
const image='https://m.media-amazon.com/images/I/product.jpg';
test('validated Amazon share has clean visible product URL and native metadata parity',async()=>{
 const map=new Map(), input=`My pick: ${source}.`;
 const expanded=await expandShortLinks(input,{amazon:'native'},async()=>new Response(null,{status:302,headers:{location:target+'?tag=affiliate'}}),map);
 const embed={url:source,title:'Kindle',description:'Reader',thumbnail:{url:image}};
 const ctx=amazonShareContext(input,[embed],map);
 assert.equal(ctx.display,`My pick: ${target}.`);
 assert.equal(embed.url,source);
 const fetcher=async()=>new Response('<meta property="og:title" content="Kindle">',{headers:{'content-type':'text/html'}});
 const short=await simplePayload(expanded,{amazon:'native'},ctx.embeds,fetcher);
 const direct=await simplePayload(expanded,{amazon:'native'},[{...embed,url:target}],fetcher);
 assert.deepEqual(short,direct);
 assert.ok(JSON.stringify(short).includes(image));
 const repost=buildRepostPayload({author:{username:'Person'}},short,ctx.display);
 assert.ok(!JSON.stringify(repost).includes('ltclid'));
 assert.ok(!JSON.stringify(repost).includes('utm_'));
});
test('failed and untrusted redirects cannot rewrite sources or associate unrelated embeds',async()=>{
 for(const location of ['https://evil.test/product','https://www.amazon.com/stores/example']){
  const map=new Map();await expandShortLinks(source,{amazon:'native'},async()=>new Response(null,{status:302,headers:{location}}),map);
  const embed={url:source,title:'Untrusted'};
  assert.deepEqual(amazonShareContext(source,[embed],map),{display:source,embeds:[embed]});
 }
 const map=new Map([[source,target]]),other={url:'https://amzn.to/other',title:'Other'};
 assert.equal(amazonShareContext(source,[other],map).embeds[0],other);
 const card=await simplePayload(target,{amazon:'native'},[other,{url:target,thumbnail:{url:'https://evil.test/image.jpg'}}],async()=>new Response('',{status:503}));
 assert.ok(!JSON.stringify(card).includes('evil.test'));
 assert.ok(!JSON.stringify(card).includes('Other'));
});
import {createHandler} from '../../src/handler.js';
import {readConfig} from '../../src/config.js';
test('handler passes validated short embed association and resolved display to reposter',async()=>{
 let sent;
 const handle=createHandler({...readConfig({}),repostEnabled:true},{canSend:()=>true,
  expandLinks:(content,modes,unused,map)=>expandShortLinks(content,modes,async()=>new Response(null,{status:302,headers:{location:target}}),map),
  makeCardPayload:(content,modes,embeds)=>simplePayload(content,modes,embeds,async()=>new Response('',{status:503})),
  repost:async(message,preview,display)=>{sent=buildRepostPayload(message,preview,display);}});
 await handle({id:'1',guildId:'2',channelId:'3',author:{username:'Person'},content:`Keep this ${source}`,embeds:[{url:source,title:'Kindle',thumbnail:{url:image}}]});
 assert.equal(sent.components[0].content,`Keep this ${target}`);
 assert.ok(JSON.stringify(sent).includes(image));
});
import {mergeAmazonEmbeds,incompleteAmazonEmbeds} from '../../src/simple-cards.js';
test('Amazon refresh merges useful fields without losing image or accepting unrelated media',()=>{
 const links=[{platform:'amazon',url:target}];
 let embeds=mergeAmazonEmbeds([],[{url:target,title:'Kindle Paperwhite',thumbnail:{url:image}}]);
 assert.equal(incompleteAmazonEmbeds(links,embeds),true);
 embeds=mergeAmazonEmbeds(embeds,[{url:target,title:'Kindle Paperwhite',description:'Reader',image:{url:'https://evil.test/image'}}]);
 assert.equal(incompleteAmazonEmbeds(links,embeds),false);
 assert.equal(embeds[0].image.url,image);
 embeds=mergeAmazonEmbeds(embeds,[{url:target,title:'Amazon'}]);
 assert.equal(embeds[0].title,'Kindle Paperwhite');
 assert.equal(embeds[0].description,'Reader');
});
test('handler refreshes incomplete native Amazon embed and keeps earlier image',async()=>{
 let calls=0,sent;
 const content='https://www.amazon.com/gp/aw/d/B08KTZ8249';
 const msg={id:'refresh',guildId:'g',channelId:'c',author:{username:'QA'},content,embeds:[{url:content,title:'Kindle Paperwhite',thumbnail:{url:image}}]};
 msg.channel={messages:{fetch:async()=>{calls++;return {...msg,embeds:[{url:content,title:'Kindle Paperwhite',description:'Reader'}]};}}};
 const handle=createHandler({...readConfig({}),repostEnabled:true},{canSend:()=>true,
 makeCardPayload:(content,modes,embeds)=>simplePayload(content,modes,embeds,async()=>new Response('',{status:503})),
 repost:async(m,p,d)=>{sent=buildRepostPayload(m,p,d);}});
 await handle(msg);
 assert.equal(calls,1);
 assert.ok(JSON.stringify(sent).includes('Kindle Paperwhite'));
 assert.ok(JSON.stringify(sent).includes(image));
});

import {metadataFromHtml} from '../../src/simple-cards.js';
test('generic Amazon shells cannot supply or overwrite product media',async()=>{
 const logo='https://m.media-amazon.com/images/I/generic-logo.jpg';
 const shell={url:target,title:'Amazon',description:'Shop online',thumbnail:{url:logo}};
 assert.equal(metadataFromHtml(`<meta property="og:title" content="Amazon"><meta property="og:image" content="${logo}">`,'amazon',target),null);
 const initial=mergeAmazonEmbeds([],[shell]);
 assert.equal(initial[0].image,undefined);
 const product={url:target,title:'Kindle Paperwhite',description:'Reader',thumbnail:{url:image}};
 const good=mergeAmazonEmbeds(initial,[product]);
 assert.equal(good[0].image.url,image);
 assert.equal(mergeAmazonEmbeds(good,[shell])[0].image.url,image);
 const card=await simplePayload(target,{amazon:'native'},[shell],async()=>new Response('',{status:503}));
 assert.ok(!JSON.stringify(card).includes(logo));
});
const recovery='https://www.amazon.com/clp/B08KTZ8249';
const productHtml=`<link rel="canonical" href="${recovery}"><meta property="og:title" content="Kindle Paperwhite"><meta property="og:image" content="${image}">`;
test('exact Amazon product redirect recovers bounded metadata and keeps dp target',async()=>{
 const calls=[];
 const card=await simplePayload(target,{amazon:'native'},[],async(url,options)=>{
 calls.push({url,options});return url===target?new Response(null,{status:301,headers:{location:recovery}}):new Response(productHtml,{headers:{'content-type':'text/html'}});
 });
 assert.equal(calls.length,2);assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[1].options.redirect,'error');
 assert.equal(calls[0].options.signal,calls[1].options.signal);
 assert.ok(JSON.stringify(card).includes(image));assert.ok(JSON.stringify(card).includes('Kindle Paperwhite'));
 assert.ok(!JSON.stringify(card).includes('/clp/'));assert.ok(JSON.stringify(card).includes(target));
});
test('Amazon recovery rejects wrong identities, redirects, shells and response limits',async()=>{
 for(const scenario of [
 {location:'https://www.amazon.com/clp/B07812QWNH'},
 {location:'https://amazon.com/clp/B08KTZ8249'},
 {location:recovery+'?extra=1'},
 {status:302},
 {body:productHtml.replace(recovery,recovery+'other')},
 {body:productHtml.replace('Kindle Paperwhite','Amazon')},
 {body:productHtml+'captcha'},
 {body:productHtml+'x'.repeat(524288)},
 {body:productHtml,contentType:'text/plain'}]){
 let calls=0;
 const card=await simplePayload(target,{amazon:'native'},[],async()=>{
 calls++;return calls===1?new Response(null,{status:301,headers:{location:scenario.location||recovery}}):new Response(scenario.body||'',{status:scenario.status||200,headers:{'content-type':scenario.contentType||'text/html',location:recovery}});
 });
 assert.ok(!JSON.stringify(card).includes(image),JSON.stringify(scenario).slice(0,100));
 assert.ok(calls<=2);
 }
});
