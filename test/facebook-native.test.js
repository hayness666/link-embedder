import test from 'node:test';
import assert from 'node:assert/strict';
import {facebookNativePayload,waitForFacebookPreview} from '../src/facebook-native.js';
const url='https://www.facebook.com/photo?fbid=123&set=a.456';
const embed={url,title:'A photo',description:'Caption',thumbnail:{url:'https://scontent-test.xx.fbcdn.net/photo.jpg'}};
test('native Facebook rebuild uses matching Discord image and exact source',()=>{
 const p=facebookNativePayload('hello\n'+url,[embed]);assert.ok(p);assert.equal(p.components[0].content,'hello\n'+url);assert.equal(p.components[1].components[1].items[0].media.url,embed.thumbnail.url);
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
