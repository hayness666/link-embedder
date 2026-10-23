import test from 'node:test';
import assert from 'node:assert/strict';
import {simplePayload,metadataFromHtml} from '../../src/simple-cards.js';
import {facebookReelVideo,facebookReelAttachment} from '../../src/providers/facebook.js';
import {readConfig} from '../../src/config.js';
import {helperUrl} from '../../src/adapters.js';
const url='https://www.facebook.com/reel/2148630336056037';
const video='https://video.fhan5-11.fna.fbcdn.net/o1/v/test.mp4?signature=keep';
const html=(id=url,media=video,title='Sullivan Twins')=>`<meta property="og:url" content="${id}"><meta property="og:title" content="${title}"><meta property="og:site_name" content="facebed by pi.kt"><meta property="og:description" content="${'🌟'.repeat(301)}"><meta property="og:video:type" content="video/mp4"><meta property="og:video" content="${media}">`;
const mp4=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);
test('Facebed Reel uses source author and shared video layout with bounded MP4 attachment',async()=>{
  const calls=[];
  const result=await simplePayload(url,{facebook:'facebed'},[],async(u,o)=>{
    calls.push([u,o]);return u===video?new Response(mp4,{headers:{'content-type':'video/mp4'}}):new Response(html(),{headers:{'content-type':'text/html'}});
  });
  assert.equal(calls[0][0],'https://www.facebed.com/reel/2148630336056037');
  assert.ok(calls.some(([u])=>u===video));assert.ok(calls.every(([,o])=>o.redirect==='error'&&o.signal));
  assert.equal(result.files[0].contentType,'video/mp4');assert.deepEqual(result.files[0].attachment,mp4);
  const card=result.components[1],texts=card.components.filter(c=>c.type===10).map(c=>c.content);
  assert.ok(texts.includes('**Sullivan Twins**'));assert.ok(!texts.join('').includes('pi.kt'));
  assert.ok(texts.includes('🌟'.repeat(300)+'…'));assert.equal(card.components.find(c=>c.type===12).items[0].media.url,'attachment://facebook-reel-0.mp4');
  assert.deepEqual(card.components.filter(c=>c.type===14).map(c=>[c.spacing,c.divider]),[[1,true]]);
  assert.deepEqual(result.allowedMentions.parse,[]);
});
test('Facebed rejects mismatched posts, helper attribution, and unsafe media',()=>{
  for(const media of ['https://evil.test/test.mp4','http://video.fhan5-11.fna.fbcdn.net/o1/v/test.mp4',video+'#fragment','https://video.fhan5-11.fna.fbcdn.net.evil.test/o1/v/test.mp4','https://127.0.0.1/o1/v/test.mp4']){
    assert.equal(facebookReelVideo(media),false);assert.equal(metadataFromHtml(html(url,media),'facebook',url),null);
  }
  assert.equal(metadataFromHtml(html(url+'1'),'facebook',url),null);
  assert.equal(metadataFromHtml(html(url,video,'facebed by pi.kt'),'facebook',url),null);
  assert.equal(helperUrl({platform:'facebook',kind:'photo',url:'https://www.facebook.com/photo?fbid=123'},'facebed'),null);
  assert.throws(()=>readConfig({FACEBOOK_MODE:'facebed'}));
  assert.equal(readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes.facebook,'facebed');
});
test('Facebed media rejects redirects, HTML, oversized streams, and false MP4 bytes',async()=>{
  const response=()=>new Response(mp4,{headers:{'content-type':'video/mp4'}});
  for(const make of [()=>new Response('blocked',{status:403}),()=>new Response(mp4,{headers:{'content-type':'text/html'}}),()=>new Response('not an mp4 file',{headers:{'content-type':'video/mp4'}}),()=>new Response(mp4,{headers:{'content-type':'video/mp4','content-length':'9000000'}}),()=>{const r=response();Object.defineProperty(r,'redirected',{value:true});return r;}])assert.equal(await facebookReelAttachment(video,async()=>make(),{remaining:8388608}),null);
  assert.equal(await facebookReelAttachment(video,async()=>response(),{remaining:8}),null);
});
test('Facebed fails closed on oversized or redirected HTML and never fetches non-Reels',async()=>{
  let calls=0;
  assert.equal(await simplePayload('https://www.facebook.com/photo?fbid=123',{facebook:'facebed'},[],async()=>{calls++;}),null);assert.equal(calls,0);
  for(const make of [()=>new Response('x'.repeat(524289),{headers:{'content-type':'text/html'}}),()=>{const r=new Response(html(),{headers:{'content-type':'text/html'}});Object.defineProperty(r,'redirected',{value:true});return r;}]){
    const result=await simplePayload(url,{facebook:'facebed'},[],async()=>make());assert.equal(result.files,undefined);assert.ok(JSON.stringify(result).includes('Reel preview unavailable.'));
  }
});


test('original and resolved Facebook Reels reach Facebed through the full handler',async()=>{
 const {createHandler}=await import('../../src/handler.js');
 for(const original of [url,'https://www.facebook.com/share/r/ExampleShare']){
  let built=0,sent;
  const config=readConfig({PROVIDER_SHARING_APPROVED:'yes',REPOST_AS_AUTHOR:'yes'});
  const handler=createHandler(config,{canSend:()=>true,expandLinks:async()=>url,
   makeCardPayload:async(content,modes)=>{built++;return simplePayload(content,modes,[],async u=>u===video?new Response(mp4,{headers:{'content-type':'video/mp4'}}):new Response(html(),{headers:{'content-type':'text/html'}}));},
   repost:async(message,payload)=>{sent=payload;}});
  await handler({id:'123',guildId:'456',channelId:'789',content:original,author:{bot:false},flags:{has:()=>false},embeds:[],channel:{}});
  assert.equal(built,1);assert.equal(sent.files[0].name,'facebook-reel-0.mp4');
 }
});
