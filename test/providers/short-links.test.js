import test from 'node:test';import assert from 'node:assert/strict';
import {shortFamily,shortLinks,resolveShortLink,expandShortLinks,expandRedditNativeShares}from '../../src/short-links.js';
import {buildRepostPayload}from '../../src/repost.js';
const redir=url=>new Response(null,{status:302,headers:{location:url}});
test('recognizes platform-owned share formats and excludes suppressed links',()=>{
 for(const [u,p]of [['https://amzn.to/abc','amazon'],['https://a.co/d/abc','amazon'],['https://www.instagram.com/share/reel/ABC','instagram'],['https://www.facebook.com/share/p/ABC/','facebook'],['https://www.reddit.com/r/cats/s/ABC','reddit'],['https://redd.it/abc','reddit'],['https://vm.tiktok.com/ABC/','tiktok'],['https://t.co/abc','twitter']])assert.equal(shortFamily(u),p,u);
 assert.deepEqual(shortLinks('<https://amzn.to/abc> ||https://a.co/def|| `https://t.co/xyz` https://redd.it/abc'),['https://redd.it/abc']);
 for(const u of ['https://amzn.to.evil.test/abc','https://amzn.to:443/abc','https://user@amzn.to/abc','http://amzn.to/abc','https://bit.ly/abc'])assert.equal(shortFamily(u),null);
});
test('resolves same-platform target without requesting destination, removes Amazon tracking',async()=>{
 const calls=[];const result=await resolveShortLink('https://amzn.to/abc',async(u,o)=>{calls.push(u);assert.equal(o.redirect,'manual');return redir('https://www.amazon.com/dp/B008JJPYFA?tag=test');});
 assert.equal(result,'https://www.amazon.com/dp/B008JJPYFA');assert.deepEqual(calls,['https://amzn.to/abc']);
});
test('blocks external and cross-platform redirects, credentials, HTTP and loops',async()=>{
 for(const target of ['https://127.0.0.1/a','http://amazon.com/dp/B008JJPYFA','https://evil.test/a','https://instagram.com/p/abc','https://user:pass@amazon.com/dp/B008JJPYFA','https://amzn.to/abc']){let n=0;assert.equal(await resolveShortLink('https://amzn.to/abc',async()=>{n++;return redir(target);}),null);assert.equal(n,1);}
});
test('unresolved and opted-out links remain unchanged; successful replacements preserve punctuation',async()=>{
 const source='See https://amzn.to/abc.';
 assert.equal(await expandShortLinks(source,{amazon:'off'},()=>{throw Error('not called');}),source);
 assert.equal(await expandShortLinks(source,{amazon:'native'},async()=>new Response('login',{status:200})),source);
 assert.equal(await expandShortLinks(source,{amazon:'native'},async()=>redir('https://amazon.com/dp/B008JJPYFA')),'See https://amazon.com/dp/B008JJPYFA.');
});
test('expanded source replaces short link once in native and custom reposts',()=>{
 const message={content:'https://amzn.to/abc',author:{username:'Person'}};const full='https://amazon.com/dp/B008JJPYFA';
 assert.equal(buildRepostPayload(message,{content:full},full).content,full);
 const p=buildRepostPayload(message,{flags:32768,components:[{type:10,content:full}]},full);assert.equal(p.components.length,1);assert.equal(message.content,'https://amzn.to/abc');
});

test('TikTok username-free share targets retain the content ID and discard tracking',async()=>{
 assert.equal(await resolveShortLink('https://www.tiktok.com/t/ZT64MgG6f/',async()=>redir('https://www.tiktok.com/@/photo/7524436543319133495?_r=1&utm_source=share')),'https://www.tiktok.com/@/photo/7524436543319133495');
 assert.equal(await resolveShortLink('https://vm.tiktok.com/ZNdwynYRc/',async()=>redir('https://www.tiktok.com/?_r=1')),null);
});

test('Reddit compact and modern share routes resolve canonical comments links',async()=>{
 for(const u of ['https://redd.it/abc123','https://www.reddit.com/r/cats/s/Share123']) {
  assert.equal(await resolveShortLink(u,async()=>new Response(null,{status:302,headers:{location:'https://www.reddit.com/comments/abc123?utm_source=share'}})),'https://www.reddit.com/comments/abc123');
 }
});

test('native Reddit share fallback requires matching source and exact Reddit preview host/path',()=>{
 const raw='https://www.reddit.com/r/aww/s/Share123?utm_source=share';
 const image={url:'https://share.redd.it/preview/post/abc123?share=token'};
 assert.equal(expandRedditNativeShares(raw,[{url:raw,image}]),'https://www.reddit.com/comments/abc123');
 for(const url of ['https://evil.test/preview/post/abc123','https://share.redd.it.evil.test/preview/post/abc123','http://share.redd.it/preview/post/abc123','https://user@share.redd.it/preview/post/abc123','https://share.redd.it/other/abc123'])
  assert.equal(expandRedditNativeShares(raw,[{url:raw,image:{url}}]),raw);
 assert.equal(expandRedditNativeShares(raw,[{url:raw+'x',image}]),raw);
 assert.equal(expandRedditNativeShares('`'+raw+'`',[{url:raw,image}]),'`'+raw+'`');
});

test('conflicting native Reddit post IDs leave the share link untouched',()=>{
 const raw='https://www.reddit.com/r/aww/s/Share123';
 const image={url:'https://share.redd.it/preview/post/abc123'};
 const thumbnail={url:'https://share.redd.it/preview/post/def456'};
 assert.equal(expandRedditNativeShares(raw,[{url:raw,image,thumbnail}]),raw);
 assert.equal(expandRedditNativeShares(raw,[{url:raw,image},{url:raw,image:thumbnail}]),raw);
 assert.equal(expandRedditNativeShares(raw,[{url:raw,image,thumbnail:image}]),'https://www.reddit.com/comments/abc123');
});
