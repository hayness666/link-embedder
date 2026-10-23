import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRedditVideo} from '../../src/short-links.js';
import {shortTitle} from '../../src/card-format.js';
import {metadataFromHtml,simpleCard,simplePayload} from '../../src/simple-cards.js';
test('public video resolver rejects offsite and credential redirects',async()=>{
 for(const location of ['https://evil.test/video/abc','https://user@www.reddit.com/video/abc','http://www.reddit.com/video/abc']) {
  let n=0;assert.equal(await resolveRedditVideo('https://v.redd.it/abc',async()=>{n++;return new Response(null,{status:302,headers:{location}})}),null);assert.equal(n,1);
 }
});
test('short-route cards recover validated community from helper metadata',()=>{
 const m=metadataFromHtml('<meta property="og:site_name" content="u/person on r/cats - stats">','reddit');
 assert.ok(JSON.stringify(simpleCard({platform:'reddit',url:'https://www.reddit.com/comments/abc'},m)).includes('**r/cats** u/person'));
});
test('long titles end at word boundary with ellipsis',()=>{
 const result=shortTitle('word '.repeat(70));assert.ok(result.endsWith('word…'));assert.ok(result.length<=256);assert.equal(shortTitle('Short title'),'Short title');
});

test('crosspost uses approved video-ID endpoint when public redirect is unavailable',async()=>{
 const p=await simplePayload('https://www.reddit.com/r/cats/comments/abc/title',{reddit:'vxreddit'},[],async u=>u.startsWith('https://v.redd.it/')?new Response(null,{status:403}):new Response('<meta property="og:description" content="https://v.redd.it/abc123">',{headers:{'Content-Type':'text/html'}}));
 assert.ok(JSON.stringify(p).includes('https://vxreddit.com/redditvideo.mp4?id=abc123'));
});
