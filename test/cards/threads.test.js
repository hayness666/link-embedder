import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialUrl, buildPayload } from '../../src/previews.js';
import { metadataFromHtml, simplePayload, validMedia } from '../../src/simple-cards.js';
import { readConfig } from '../../src/config.js';
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

import { cleanThreadsLinks } from '../../src/urls.js';
test('Threads visible cleanup preserves prose and functional parameters', () => {
 assert.equal(cleanThreadsLinks(`Look (${url}?utm_source=test&foo=keep)!`),`Look (${url}?foo=keep)!`);
 assert.equal(cleanThreadsLinks('https://threads.com/@meta?utm_source=test'),'https://threads.com/@meta?utm_source=test');
});

import { metadataFromThreads } from '../../src/simple-cards.js';
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
 const data=activity({content:'a'.repeat(300)+'<br><blockquote><b>Quote of <a href="https://www.threads.com/@person">@person</a></b><br>'+ 'b'.repeat(301)+'</blockquote><br><b>❤️ 1   💬 0   🔄 0   ✈️ 0</b>',media_attachments:[{type:'video',url:helperImage.replace('photo.jpg','video.mp4')}]});
 const p=await simplePayload(url,{threads:'fzthreads'},[],async()=>new Response(JSON.stringify(data),{headers:{'content-type':'application/activity+json'}}));
 const c=p.components[1].components,main=c.findIndex(c=>c.content==='a'.repeat(300)),media=c.findIndex(c=>c.type===12),quote=c.findIndex(c=>c.content?.startsWith('> '));
 assert.ok(main>=0&&main<media&&media<quote);assert.ok(c[quote].content.includes('b'.repeat(300)+'…'));assert.ok(!JSON.stringify(p).includes('❤️'));
});

test('Threads approved helper passes the initial message routing gate',()=>{
 const payload=buildPayload(url,readConfig({PROVIDER_SHARING_APPROVED:'yes'}).modes);
 assert.ok(payload);assert.ok(payload.content.includes('https://fzthreads.com/@meta/post/DDzbnVKx57R'));
});


test('Threads quote headers are language independent and bound to a matching public profile',async()=>{
 for(const label of ['Quote of','↪ 引用']) {
  const data=activity({content:`Main text<br><blockquote><b>${label} <a href="https://www.threads.com/@person">@person</a></b><br>${'q'.repeat(301)}</blockquote>`,media_attachments:[]});
  const metadata=metadataFromThreads(data,url);
  assert.equal(metadata.caption,'Main text');assert.equal(metadata.quote.username,'person');
  const p=await simplePayload(url,{threads:'fzthreads'},[],async()=>new Response(JSON.stringify(data),{headers:{'content-type':'application/activity+json'}}));
  const c=p.components.find(x=>x.type===17).components;
  assert.ok(c.findIndex(x=>x.content==='Main text')<c.findIndex(x=>x.content?.startsWith('> ')));
  assert.ok(c.find(x=>x.content?.startsWith('> ')).content.endsWith('q'.repeat(300)+'…'));
  assert.deepEqual(c.at(-2),{type:14,divider:true,spacing:1});
 }
 for(const href of ['https://evil.test/@person','https://www.threads.com/@other','https://www.threads.com/@person?x=1','http://www.threads.com/@person','https://user@www.threads.com/@person']) {
  const m=metadataFromThreads(activity({content:`Main<br><blockquote><b>Quote of <a href="${href}">@person</a></b><br>Keep this text</blockquote>`}),url);
  assert.equal(m.quote,null);assert.match(m.caption,/Keep this text/);
 }
 const ordinary=metadataFromThreads(activity({content:'Main<br><blockquote>Ordinary body text</blockquote>'}),url);
 assert.equal(ordinary.quote,null);assert.match(ordinary.caption,/Ordinary body text/);
});

test('Threads quoted names use matching identities and safe bounded helper profile metadata',async()=>{
 const {threadsProfileName}=await import('../../src/simple-cards.js');
 const profile=(name='Other Person',handle='other',locked=false)=>`<script id="discord:component-embed">${JSON.stringify({component:{type:17,components:[{type:9,components:[{type:10,content:`### [${name}](https://www.threads.com/@${handle})\n${handle}${locked?'\n-# 🔒':''}`}]}]}})}</script>`;
 const quote=(handle)=>`Main<br><blockquote><b>↪ 引用 <a href="https://www.threads.com/@${handle}">@${handle}</a></b><br>Quoted text</blockquote>`;
 const self=metadataFromThreads(activity({content:quote('META')}),url);assert.equal(self.quote.name,'Meta');
 const missing=metadataFromThreads(activity({content:quote('meta'),account:{locked:false,username:'meta'}}),url);assert.equal(missing.quote.name,'');
 const other=activity({content:quote('other')});assert.equal(metadataFromThreads(other,url).quote.name,'');
 const calls=[];
 const result=await simplePayload(url,{threads:'fzthreads'},[],async(u,o)=>{calls.push(u);assert.equal(o.redirect,'error');assert.ok(o.signal);return new Response(u.endsWith('/activity')?JSON.stringify(other):profile(),{headers:{'content-type':u.endsWith('/activity')?'application/json':'text/html'}});});
 assert.deepEqual(calls,['https://fzthreads.com/@meta/post/DDzbnVKx57R/activity','https://fzthreads.com/@other']);assert.match(JSON.stringify(result),/Other Person/);
 for(const bad of [profile('Other Person','wrong'),profile('Other Person','other',true),'<script id="discord:component-embed">{broken}</script>',profile('','other')]) assert.equal(threadsProfileName(bad,'other'),'');
 const fallback=await simplePayload(url,{threads:'fzthreads'},[],async u=>u.endsWith('/activity')?new Response(JSON.stringify(other),{headers:{'content-type':'application/json'}}):new Response('',{status:503}));assert.match(JSON.stringify(fallback),/Quoted post/);assert.doesNotMatch(fallback.components.find(c=>c.type===17).components.find(c=>c.content?.startsWith('> ')).content,/Meta/);
 let requests=0;const selfCard=await simplePayload(url,{threads:'fzthreads'},[],async()=>{requests++;return new Response(JSON.stringify(activity({content:quote('meta')})),{headers:{'content-type':'application/json'}});});assert.equal(requests,1);assert.match(JSON.stringify(selfCard),/Meta/);
});

test('Threads removes only the exact leading helper reply annotation and preserves body language and quotes',()=>{
 const header='⤴️ 正在回覆 <a href="https://www.threads.com/@00joshieg">@00joshieg</a><br><br>';
 const quote='<blockquote><b>↪ 引用 <a href="https://www.threads.com/@person">@person</a></b><br>正在回覆 @someone</blockquote>';
 const m=metadataFromThreads(activity({content:header+'Actual 中文 body<br>- signature<br>'+quote}),url);
 assert.equal(m.caption,'Actual 中文 body\n- signature');assert.equal(m.quote.text,'正在回覆 @someone');
 for(const body of ['正在回覆 @00joshieg<br><br>Actual body','⤴️ 正在回覆 @00joshieg<br><br>Actual body','User text<br>'+header+'Actual body',header.replace('@00joshieg</a>','@other</a>')+'Actual body',header.replace('www.threads.com','evil.test')+'Actual body']){
  assert.ok(metadataFromThreads(activity({content:body}),url).caption.includes('正在回覆'));
 }
});
