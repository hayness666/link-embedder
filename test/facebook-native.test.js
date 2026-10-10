import test from 'node:test';
import assert from 'node:assert/strict';
import {facebookNativePayload,waitForFacebookPreview,cleanFacebookPhotoSets} from '../src/facebook-native.js';
const url='https://www.facebook.com/photo?fbid=123&set=a.456';
const embed={url,title:'A photo',description:'Caption',thumbnail:{url:'https://scontent-test.xx.fbcdn.net/photo.jpg'}};
test('native Facebook rebuild uses matching Discord image and exact source',()=>{
 const p=facebookNativePayload('hello\n'+url,[embed]);assert.ok(p);assert.equal(p.components[0].content,'hello\n'+url);assert.equal(p.components[1].components.filter(c=>c.type!==14)[1].items[0].media.url,embed.thumbnail.url);
 for(const bad of ['https://evil.test/a','http://scontent-test.xx.fbcdn.net/a','https://scontent-test.xx.fbcdn.net@evil.test/a'])assert.equal(facebookNativePayload(url,[{...embed,thumbnail:{url:bad}}]),null);
 assert.equal(facebookNativePayload(url,[{...embed,url:'https://www.facebook.com/photo?fbid=999'}]),null);
 assert.equal(facebookNativePayload(url+' https://www.instagram.com/p/ABC',[embed]),null);
});
test('native preview waits boundedly and preserves source on edits or no image',async()=>{
 let calls=0;const m={id:'1',content:url,embeds:[],channel:{messages:{fetch:async()=>{calls++;return {...m,embeds:[embed]};}}}};
 assert.ok(await waitForFacebookPreview(m,async()=>{}));assert.equal(calls,1);
 m.channel.messages.fetch=async()=>({...m,content:'changed',embeds:[embed]});assert.equal(await waitForFacebookPreview(m,async()=>{}),null);
 calls=0;m.channel.messages.fetch=async()=>{calls++;return m;};assert.equal(await waitForFacebookPreview(m,async()=>{}),null);assert.equal(calls,3);
});

test('Facebook photo cleanup removes album set only',()=>{assert.equal(cleanFacebookPhotoSets('hello https://www.facebook.com/photo?fbid=123&set=a.456&foo=keep'),'hello https://www.facebook.com/photo?fbid=123&foo=keep');assert.equal(cleanFacebookPhotoSets('https://www.youtube.com/watch?v=abc&set=keep'),'https://www.youtube.com/watch?v=abc&set=keep');});

import {parseSocialUrl} from '../src/previews.js';
import {simpleCard} from '../src/simple-cards.js';
test('broader Facebook routes retain functional IDs and reject unsafe/system routes',()=>{
 for(const [path,kind] of [['/groups/123/posts/456','post'],['/NASA/posts/a-caption/123','post'],['/NASA/videos/123','video'],['/watch/?v=123&tracking=remove','video'],['/stories/123/456','story']])assert.equal(parseSocialUrl('https://www.facebook.com'+path)?.kind,kind,path);
 assert.equal(parseSocialUrl('https://www.facebook.com/watch/?v=123&tracking=remove').url,'https://www.facebook.com/watch?v=123');
 for(const url of ['https://facebook.com/login','https://facebook.com/checkpoint','https://facebook.com/settings','https://facebook.com.evil.test/NASA','https://fb.watch/reel/123','https://facebook.com/watch?v=wrong'])assert.equal(parseSocialUrl(url),null,url);
 for(const path of ['/NASA','/groups/123','/events/123','/marketplace/item/123','/share/p/abc','/profile.php?id=123','/media/set/?set=a.123','/watch/NASA/123']) assert.equal(parseSocialUrl('https://www.facebook.com'+path),null,path);
 assert.equal(parseSocialUrl('https://fb.watch/abc/'),null);
});
test('real text-only Facebook post metadata survives, generic login cards do not',()=>{
 const event='https://www.facebook.com/NASA/posts/123';
 const payload=facebookNativePayload(event,[{url:event,title:'Science live',description:'Join the public science event'}]);
 assert.ok(payload); assert.match(JSON.stringify(payload),/Science live/);assert.ok(!payload.components[1].components.some(c=>c.type===12));
 assert.equal(facebookNativePayload(event,[{url:event,title:'Log in or sign up to view',description:'See posts, photos and more on Facebook.',thumbnail:embed.thumbnail}]),null);
 assert.match(JSON.stringify(simpleCard(parseSocialUrl('https://www.facebook.com/NASA/videos/123'))),/Video preview unavailable/);
});
