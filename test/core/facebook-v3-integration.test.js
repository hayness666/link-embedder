import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler} from '../../src/handler.js';import {readConfig} from '../../src/config.js';import {waitForFacebookPreview} from '../../src/providers/facebook.js';import {buildRepostPayload} from '../../src/repost.js';
const photo='https://www.facebook.com/photo?fbid=1806517487514738';
const config=readConfig({PROVIDER_SHARING_APPROVED:'yes',REPOST_AS_AUTHOR:'yes'});
test('v3 delayed native photo reaches replacement, and repeated URLs with new IDs work',async()=>{
 let time=10000;const sent=[],logs=[];let refreshes=0;
 const h=createHandler(config,{facebookPublicKinds:[],facebookPublicSources:[],canSend:()=>true,now:()=>time,log:x=>logs.push(x),nativeFacebook:m=>waitForFacebookPreview(m,async()=>{},async()=>new Response(null,{status:403})),repost:async(m,p)=>{sent.push(buildRepostPayload(m,p));}});
 const base={guildId:'1',channelId:'2',content:photo,author:{id:'3',bot:false,username:'Example'},flags:{has:()=>false},editedTimestamp:null,embeds:[],channel:{messages:{fetch:async()=>{refreshes++;return {...base,embeds:[{url:photo,title:'This is a Clue - 🌱',description:'Write down your team’s answer',image:{url:'https://scontent-test.xx.fbcdn.net/photo.jpg'}}]};}}}};
 await h({...base,id:'one'});time+=4000;await h({...base,id:'two'});
 assert.equal(sent.length,2);assert.equal(refreshes,2);assert.deepEqual(logs,[]);assert.ok(sent.every(p=>p.flags===32768&&p.components.find(c=>c.type===17).components[0].content.includes('Facebook Photo')));
});
test('missing native/public photo content preserves original without an empty replacement',async()=>{
 let sent=0;
 const h=createHandler(config,{facebookPublicKinds:[],facebookPublicSources:[],canSend:()=>true,nativeFacebook:async()=>null,repost:async()=>{sent++;}});
 await h({id:'1',guildId:'1',channelId:'2',content:photo,author:{bot:false},flags:{has:()=>false},embeds:[]});assert.equal(sent,0);
});
test('repeated URL cooldown applies to new messages for three seconds, not indefinitely',async()=>{
 let time=10000,sent=0;const h=createHandler(config,{facebookPublicKinds:[],facebookPublicSources:[],canSend:()=>true,now:()=>time,nativeFacebook:async()=>({components:[{content:photo}]}),repost:async()=>{sent++;}});
 const m={guildId:'1',channelId:'2',content:photo,author:{bot:false},flags:{has:()=>false},embeds:[]};
 await h({...m,id:'1'});await h({...m,id:'2'});assert.equal(sent,1);time+=3001;await h({...m,id:'3'});assert.equal(sent,2);
});
