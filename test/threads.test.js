import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialUrl, buildPayload } from '../src/previews.js';
import { metadataFromHtml, simplePayload, validMedia } from '../src/simple-cards.js';
import { readConfig } from '../src/config.js';
const url = 'https://www.threads.com/@meta/post/DDzbnVKx57R';
const image = 'https://scontent-den2-1.xx.fbcdn.net/v/t51.29350-15/photo.jpg?sig=keep';
const tags = (extra='') => `<meta property="og:url" content="${url}"><meta property="og:title" content="Meta (@meta) on Threads"><meta property="og:description" content="Public caption">${extra}`;
test('Threads supports exact public legacy and current post routes only', () => {
  assert.equal(parseSocialUrl('https://threads.net/@meta/post/DDzbnVKx57R?utm_source=share').url,url);
  assert.equal(parseSocialUrl('https://threads.com/t/DDzbnVKx57R').platform,'threads');
  for (const bad of ['https://threads.com.evil.test/@meta/post/abc','https://threads.com:443/@meta/post/abc','https://user@threads.com/@meta/post/abc','https://threads.com/@meta','https://threads.com/search']) assert.equal(parseSocialUrl(bad),null);
  assert.equal(readConfig({}).modes.threads,'card');
});
test('Threads accepts matched public caption and media without treating avatar as post photo', () => {
  const data=metadataFromHtml(tags(`<meta property="og:image" content="${image}">`),'threads',url);
  assert.equal(data.name,'Meta'); assert.equal(data.username,'meta'); assert.deepEqual(data.media,[image]);
  assert.equal(metadataFromHtml(tags(),'threads',url+'/wrong'),null);
  assert.equal(metadataFromHtml(`<meta property="og:url" content="${url}"><meta property="og:image" content="${image}">`,'threads',url),null);
  assert.deepEqual(metadataFromHtml(tags('<meta property="og:image" content="https://scontent-den2-1.xx.fbcdn.net/v/t39.92108-6/avatar.jpg">'),'threads',url).media,[]);
  assert.equal(validMedia('https://scontent-den2-1.xx.fbcdn.net.evil.test/image.jpg','threads'),false);
  const video=image.replace('photo.jpg','movie.mp4');
  assert.deepEqual(metadataFromHtml(tags(`<meta property="og:video:type" content="video/mp4"><meta property="og:video" content="${video}">`),'threads',url).media,[video]);
});
test('Threads fetch errors give honest card and retain prose without accepting unrelated native metadata', async () => {
 const payload=await simplePayload(`My words ${url}`,{threads:'card'},[{url,title:'Log in',description:'Sign up'}],async()=>{throw Error('offline');});
 const rendered=JSON.stringify(payload);
 assert.ok(rendered.includes('My words')); assert.ok(rendered.includes('Media preview unavailable')); assert.ok(!rendered.includes('Sign up'));
});
test('Threads public metadata is rendered in the standard custom card', async () => {
 const payload=await simplePayload(url,{threads:'card'},[],async(request,options)=>{
  assert.equal(request,url); assert.equal(options.redirect,'error');
  return new Response(tags(`<meta property="og:image" content="${image}">`),{headers:{'content-type':'text/html'}});
 });
 assert.ok(JSON.stringify(payload).includes(image));
 assert.ok(JSON.stringify(payload).includes('Threads Post'));
});

import { cleanThreadsLinks } from '../src/urls.js';
test('Threads visible cleanup preserves prose and functional parameters', () => {
 assert.equal(cleanThreadsLinks(`Look (${url}?utm_source=test&foo=keep)!`),`Look (${url}?foo=keep)!`);
 assert.equal(cleanThreadsLinks('https://threads.com/@meta?utm_source=test'),'https://threads.com/@meta?utm_source=test');
});

import { metadataFromThreads } from '../src/simple-cards.js';
const helperImage='https://scontent-iad3-1.cdninstagram.com/v/t51.82787-15/photo.jpg?sig=keep';
const activity=(overrides={})=>({url:'https://www.threads.com/t/DDzbnVKx57R',visibility:'public',sensitive:false,spoiler_text:'',account:{locked:false,display_name:'Meta',username:'meta',avatar:'https://scontent-iad3-1.cdninstagram.com/v/t51.82787-19/avatar.jpg'},content:'Caption &amp; more<br>\u200a<br><b>❤️ 3,883   💬 110   🔄 260   ✈️ 47</b>',media_attachments:[{type:'image',url:helperImage}],...overrides});
test('approved Threads helper uses bounded activity metadata and own layout',async()=>{
 assert.equal(readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes.threads,'fzthreads');
 assert.throws(()=>readConfig({THREADS_MODE:'fzthreads'}),/approved/);
 const calls=[];
 const p=await simplePayload(`My words ${url}`,{threads:'fzthreads'},[],async(u,o)=>{
  calls.push(u);assert.equal(o.redirect,'error');assert.ok(o.signal);
  return new Response(JSON.stringify(activity()),{headers:{'content-type':'application/activity+json'}});
 });
 assert.deepEqual(calls,['https://fzthreads.com/@meta/post/DDzbnVKx57R/activity']);
 const c=p.components[1].components;
 assert.equal(p.components[0].content,`My words ${url}`);
 assert.ok(c.findIndex(c=>c.content==='Caption & more')<c.findIndex(c=>c.type===12));
 assert.ok(!JSON.stringify(p).includes('3,883')); assert.ok(JSON.stringify(p).includes(helperImage));
});
test('Threads rejects private, mismatched, spoiler and avatar-only helper responses',()=>{
 for(const changes of [{url:'https://www.threads.com/t/wrong'},{url:'https://evil.test/t/DDzbnVKx57R'},{visibility:'private'},{sensitive:true},{sensitive:undefined},{spoiler_text:'CW'},{account:{locked:true}}]) assert.equal(metadataFromThreads(activity(changes),url),null);
 for(const bad of ['https://scontent-iad3-1.cdninstagram.com.evil.test/a.jpg','https://evil.cdninstagram.com/a.jpg','http://scontent-iad3-1.cdninstagram.com/a.jpg','https://user:pass@scontent-iad3-1.cdninstagram.com/a.jpg','https://scontent-iad3-1.cdninstagram.com/v/t51.82787-19/avatar.jpg']) assert.deepEqual(metadataFromThreads(activity({media_attachments:[{type:'image',url:bad}]}),url).media,[]);
 assert.equal(metadataFromThreads(activity({content:'',media_attachments:[]}),url),null);
});
test('Threads helper failure cannot leak spoiler content through fallback fetching',async()=>{
 for(const response of [new Response('error',{status:503}),new Response(JSON.stringify(activity({sensitive:true})),{headers:{'content-type':'application/activity+json'}}),new Response('x'.repeat(524289),{headers:{'content-type':'application/activity+json'}})]){
  let calls=0;const p=await simplePayload(url,{threads:'fzthreads'},[],async()=>{calls++;return response;});
  assert.equal(calls,1);assert.ok(JSON.stringify(p).includes('Media preview unavailable'));assert.ok(!JSON.stringify(p).includes(helperImage));
 }
});
test('Threads full main text remains above media with capped quote below',async()=>{
 const data=activity({content:'a'.repeat(300)+'<br><blockquote><b>Quote of <a href="https://www.threads.com/@person">@person</a></b><br>'+ 'b'.repeat(300)+'</blockquote><br><b>❤️ 1   💬 0   🔄 0   ✈️ 0</b>',media_attachments:[{type:'video',url:helperImage.replace('photo.jpg','video.mp4')}]});
 const p=await simplePayload(url,{threads:'fzthreads'},[],async()=>new Response(JSON.stringify(data),{headers:{'content-type':'application/activity+json'}}));
 const c=p.components[1].components,main=c.findIndex(c=>c.content==='a'.repeat(300)),media=c.findIndex(c=>c.type===12),quote=c.findIndex(c=>c.content?.startsWith('> '));
 assert.ok(main>=0&&main<media&&media<quote);assert.ok(c[quote].content.includes('b'.repeat(249)+'…'));assert.ok(!JSON.stringify(p).includes('❤️'));
});

test('Threads approved helper passes the initial message routing gate',()=>{
 const payload=buildPayload(url,readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes);
 assert.ok(payload);assert.ok(payload.content.includes('https://fzthreads.com/@meta/post/DDzbnVKx57R'));
});
