import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSocialUrl } from '../src/previews.js';
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
