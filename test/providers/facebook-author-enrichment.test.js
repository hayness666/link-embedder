import test from 'node:test';import assert from 'node:assert/strict';
import {createFacebookAuthorLookup} from '../../src/providers/facebook-author-enrichment.js';
import {createFacebedFacebookPreview} from '../../src/providers/facebook-facebed-preview.js';
const photo={link:{kind:'photo',id:'123',url:'https://www.facebook.com/photo?fbid=123'},name:'Example',handle:''};
const head=(url,name='')=>`<link rel="canonical" href="${url}">${name?`<meta property="og:title" content="${name}">`:''}</head>`;
const response=body=>new Response(body,{headers:{'content-type':'text/html'}});
test('verified photo owner/profile enriches and caches without reusing another content identity',async()=>{
 let calls=0,time=0;const lookup=createFacebookAuthorLookup({now:()=>time,fetcher:async(u,o)=>{calls++;assert.equal(o.redirect,'error');return response(u.includes('photo?')?head('https://www.facebook.com/example/photos/123'):head('https://www.facebook.com/example/','Example'));}});
 assert.equal(await lookup(photo),'example');assert.equal(await lookup(photo),'example');assert.equal(calls,2);
 assert.equal(await lookup({...photo,link:{...photo.link,id:'999',url:'https://www.facebook.com/photo?fbid=999'}}),'');
 time=300001;assert.equal(await lookup(photo),'example');assert.equal(calls,5);
});
test('mismatched profile/name, unsafe canonical, absent metadata, and login redirects omit the handle',async()=>{
 for(const body of [head('https://www.facebook.com/example/photos/999'),head('https://evil.test/example/photos/123'),'',head('https://www.facebook.com/login')])assert.equal(await createFacebookAuthorLookup({fetcher:async()=>response(body)})(photo),'');
 for(const body of [head('https://www.facebook.com/other/','Example'),head('https://www.facebook.com/example/','Different')])assert.equal(await createFacebookAuthorLookup({fetcher:async u=>response(u.includes('photo?')?head('https://www.facebook.com/example/photos/123'):body)})(photo),'');
 assert.equal(await createFacebookAuthorLookup({fetcher:async()=>new Response(null,{status:302,headers:{location:'https://www.facebook.com/login'}})})(photo),'');
});
test('video handle requires independent matching canonical and oEmbed content IDs',async()=>{
 const meta={...photo,link:{kind:'video',id:'456',url:'https://www.facebook.com/untrusted/videos/456'}};
 const owner='https://www.facebook.com/verified/videos/456';
 const html=head(owner)+`<link rel="alternate" type="application/json+oembed" href="https://graph.facebook.com/v1.0/oembed_video?url=${encodeURIComponent(owner)}">`;
 assert.equal(await createFacebookAuthorLookup({fetcher:async()=>response(html)})(meta),'verified');
 assert.equal(await createFacebookAuthorLookup({fetcher:async()=>response(html.replaceAll('456','999'))})(meta),'');
});
test('lookup timeout aborts and negatively caches without holding successful media hostage',async()=>{
 let calls=0,signal;const lookup=createFacebookAuthorLookup({timeoutMs:10,fetcher:async(u,o)=>{calls++;signal=o.signal;return new Promise(()=>{});}});
 assert.equal(await lookup(photo),'');assert.equal(signal.aborted,true);assert.equal(await lookup(photo),'');assert.equal(calls,1);
 const body='<meta property="og:url" content="https://www.facebook.com/photo?fbid=123"><meta property="og:title" content="Example"><meta property="og:description" content="Caption"><meta property="og:image" content="https://scontent-test.xx.fbcdn.net/v/t/image.jpg">';
 const payload=await createFacebedFacebookPreview({allowedKinds:['photo'],fetcher:async()=>response(body),authorLookup:async()=>{throw Error('unavailable');}})(photo.link.url);
 assert.ok(payload.components[1].components.some(x=>x.type===12));assert.ok(JSON.stringify(payload).includes('Caption'));
});
