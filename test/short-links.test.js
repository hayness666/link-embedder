import test from 'node:test';import assert from 'node:assert/strict';
import {shortFamily,shortLinks,resolveShortLink,expandShortLinks}from '../src/short-links.js';
import {buildRepostPayload}from '../src/repost.js';
const redir=url=>new Response(null,{status:302,headers:{location:url}});
test('recognizes platform-owned share formats and excludes suppressed links',()=>{
 for(const [u,p]of [['https://amzn.to/abc','amazon'],['https://a.co/d/abc','amazon'],['https://www.instagram.com/share/reel/ABC','instagram'],['https://www.facebook.com/share/p/ABC/','facebook'],['https://www.reddit.com/r/cats/s/ABC','reddit'],['https://redd.it/abc','reddit'],['https://vm.tiktok.com/ABC/','tiktok'],['https://lnkd.in/abc','linkedin'],['https://t.co/abc','twitter'],['https://xhslink.com/a/abc','rednote'],['https://t.snapchat.com/abc','snapchat']])assert.equal(shortFamily(u),p,u);
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
