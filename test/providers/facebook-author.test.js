import test from 'node:test';import assert from 'node:assert/strict';
import {facebookPhotoAuthor,waitForFacebookPreview} from '../../src/providers/facebook.js';
const url='https://www.facebook.com/photo?fbid=1806517487514738';
// Minimal observed public tags; no identity override or hardcoded production mapping.
const photo='<link rel="canonical" href="https://www.facebook.com/thisisaclue/photos/write-down-your-teams-answer-and-hand-it-to-your-trivia-host-for-1-point-830-952/1806517487514738/">';
const profile='<meta property="og:title" content="This is a Clue"><link rel="canonical" href="https://www.facebook.com/thisisaclue/">';
const response=text=>new Response(text,{headers:{'content-type':'text/html'}});
test('observed photo canonical and independently bound profile recover real name and handle',async()=>{
 const calls=[];const fetcher=async(u,o)=>{calls.push(u);assert.equal(o.redirect,'error');return response(calls.length===1?photo:profile);};
 assert.deepEqual(await facebookPhotoAuthor(url,fetcher),{name:'This is a Clue',url:'https://www.facebook.com/thisisaclue/'});
 assert.deepEqual(calls,[url,'https://www.facebook.com/thisisaclue/']);
 const m={content:url,embeds:[{url,title:'This is a Clue - 🌱 🌳 🌿 🍃',description:'Write down your team’s answer',image:{url:'https://scontent-test.xx.fbcdn.net/photo.jpg'}}]};
 const p=await waitForFacebookPreview(m,async()=>{},async u=>response(u===url?photo:profile));
 assert.equal(p.components[1].components[2].content,'**This is a Clue** @\u200bthisisaclue');
 assert.equal(p.components[1].components[4].content,'Write down your team’s answer');
});
test('author lookup rejects mismatched identities, hosts, shells, redirects, and excessive HTML',async()=>{
 for(const bad of [photo.replace('1806517487514738','123'),photo.replace('www.facebook.com','evil.test'),'x'.repeat(524289),'<title>This is a Clue</title>']){
  let calls=0;assert.equal(await facebookPhotoAuthor(url,async()=>{calls++;return response(bad);}),null);assert.equal(calls,1);
 }
 for(const bad of [profile.replace('thisisaclue','anotherpage'),profile.replace('This is a Clue','Log in to Facebook')])assert.equal(await facebookPhotoAuthor(url,async u=>response(u===url?photo:bad)),null);
 assert.equal(await facebookPhotoAuthor(url,async()=>{const r=response(photo);Object.defineProperty(r,'redirected',{value:true});return r;}),null);
});

test('author metadata stops at bounded HTML head instead of reading large page body',async()=>{
 let cancelled=0;
 const result=await facebookPhotoAuthor(url,async u=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('<head>'+(u===url?photo:profile)+'</head>'));},cancel(){cancelled++;}}),{headers:{'content-type':'text/html','content-length':'2000000'}}));
 assert.equal(result.name,'This is a Clue');assert.equal(cancelled,2);
});

test('native canonical owner/photo URL matches the requested fbid, not unrelated content',async()=>{
 const {facebookNativePayload}=await import('../../src/providers/facebook.js');
 const canonical='https://www.facebook.com/thisisaclue/photos/write-down-your-teams-answer-and-hand-it-to-your-trivia-host-for-1-point-830-952/1806517487514738/';
 const embed={url:canonical,title:'This is a Clue',description:'Caption',image:{url:'https://scontent-test.xx.fbcdn.net/photo.jpg'}};
 assert.ok(facebookNativePayload(url,[embed]));
 assert.equal(facebookNativePayload(url,[{...embed,url:canonical.replace('1806517487514738','123')}]),null);
 assert.equal(facebookNativePayload(url,[{...embed,url:canonical.replace('www.facebook.com','evil.test')}]),null);
 const p=await waitForFacebookPreview({content:url,embeds:[embed]},async()=>{},async u=>response(u===url?photo:profile));
 assert.ok(p.components[1].components.some(c=>c.content==='**This is a Clue** @\u200bthisisaclue'));
});
