import test from 'node:test';import assert from 'node:assert/strict';
import {facebookReelAuthor} from '../../src/providers/facebook.js';
const url='https://www.facebook.com/reel/2148630336056037';
const source='https://www.facebook.com/Sullivantwins/videos/lets-try-this-one/2148630336056037/';
const ref=(target=source)=>`<link rel="alternate" href="https://graph.facebook.com/v26.0/oembed_video?url=${encodeURIComponent(target)}" type="application/json+oembed">`;
const profile='<meta property="og:title" content="Sullivan Twins"><link rel="canonical" href="https://www.facebook.com/Sullivantwins/">';
const response=s=>new Response(s+'</head>',{headers:{'content-type':'text/html'}});
test('observed matching video owner reference resolves verified profile handle without Graph requests',async()=>{
 const calls=[];const author=await facebookReelAuthor(url,async(u,o)=>{calls.push(u);assert.equal(o.redirect,'error');return response(ref()+`<link rel="canonical" href="${source}">`);});
 assert.deepEqual(author,{username:'Sullivantwins'});assert.deepEqual(calls,[url]);
});
test('Reel author rejects wrong video, hostile owner host, ambiguous profiles, and login shells',async()=>{
 for(const html of [ref(source.replace('2148630336056037','123')),ref(source.replace('www.facebook.com','evil.test')),ref()+ref(source.replace('Sullivantwins','anotherperson')),'<meta property="og:title" content="Sullivan Twins">']){
  let n=0;assert.equal(await facebookReelAuthor(url,async()=>{n++;return response(html);}),null);assert.equal(n,1);
 }
 for(const html of [profile.replace('Sullivan Twins','Log in to Facebook'),profile.replace('/Sullivantwins/','/anotherperson/')])assert.equal(await facebookReelAuthor(url,async u=>response(u===url?ref():html)),null);
 assert.equal(await facebookReelAuthor(url,async()=>{throw Error('Network failure');}),null);
});
