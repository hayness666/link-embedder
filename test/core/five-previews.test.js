import test from 'node:test';import assert from 'node:assert/strict';
import {extractLinks} from '../../src/previews.js';
import {shortLinks,expandShortLinks} from '../../src/short-links.js';
import {simplePayload} from '../../src/simple-cards.js';
import {withCardControls} from '../../src/card-controls.js';
import {checkReplyBudget} from '../../src/reply-context.js';
import {buildRepostPayload,createReposter} from '../../src/repost.js';
import {buildEditedPost} from '../../src/edit-post.js';
const urls=['https://twitter.com/example/status/123','https://bsky.app/profile/example.com/post/abc123','https://www.reddit.com/r/science/comments/abc123/example','https://www.pinterest.com/pin/123/','https://www.amazon.com/dp/B000000001','https://www.instagram.com/p/ABC123'];
const modes={twitter:'fxembed',bluesky:'fxembed',reddit:'vxreddit',pinterest:'card',amazon:'card',instagram:'oginstagram',facebook:'facebed'};
const card=(caption='Short text')=>({type:17,components:[{type:10,content:'Title\nAuthor'},{type:10,content:caption},{type:14,divider:true},{type:10,content:'Credit'}]});
test('first five distinct links are processed; sixth and unsupported URLs remain in human text',()=>{
 const text=['My words',urls[0],...urls,'https://example.org/other'].join(' ');
 assert.equal(extractLinks(text).length,5);assert.deepEqual(extractLinks(text).map(l=>l.platform),['twitter','bluesky','reddit','pinterest','amazon']);
 const p=buildRepostPayload({content:text,author:{username:'Person'}},{flags:32768,components:[{type:10,content:text},...Array.from({length:5},()=>card())]});
 assert.equal(p.components[0].content,text);checkReplyBudget(withCardControls(p.components));
});
test('up to five short links expand; later links remain intact and duplicates resolve once',async()=>{
 const links=Array.from({length:6},(_,i)=>`https://redd.it/abc${i}`),seen=[];
 assert.equal(shortLinks([...links,links[0]].join(' ')).length,5);
 const out=await expandShortLinks(links.join(' '),modes,async u=>{seen.push(u);return new Response(null,{status:302,headers:{location:`https://www.reddit.com/comments/${u.split('/').at(-1)}`}});});
 assert.equal(seen.length,5);assert.ok(out.endsWith(links[5]));assert.equal(extractLinks(out).length,5);
});
test('five mixed cards fit when small; unavailable Facebook mixed path remains excluded',async()=>{
 const text=urls.slice(0,5).join(' ');const p=await simplePayload(text,modes,[],async()=>new Response('',{status:403}));
 assert.equal(p.components.filter(c=>c.type===17).length,5);checkReplyBudget(withCardControls(p.components));
 assert.equal(await simplePayload('https://www.facebook.com/photo?fbid=123 '+urls[0],modes,[],()=>assert.fail('No mixed Facebook request')),null);
});
test('final component and reply text budgets reject overflow without removing source',async()=>{
 const dense=()=>({...card(),components:[...card().components,{type:12,items:[{media:{url:'https://example.org/image.jpg'}}]}]});
 assert.throws(()=>withCardControls([{type:10,content:'source'},...Array.from({length:5},dense)]),/limit/);
 const forty=[{type:10,content:'source'},...Array.from({length:39},()=>({type:10,content:'x'}))];checkReplyBudget(forty);assert.throws(()=>checkReplyBudget([{type:10,content:'reply'},...forty]),/budget/);
 const calls=[],user={id:'bot'},message={id:'source',type:0,deletable:true,content:urls[0],author:{id:'owner',username:'Person'},channel:{type:0,permissionsFor:()=>({has:()=>true}),fetchWebhooks:()=>{calls.push('webhook');throw Error();}},delete:()=>calls.push('delete')};
 const owners={put:()=>calls.push('ownership')};
 for(const components of [[{type:10,content:message.content},...Array.from({length:5},dense)],[{type:10,content:message.content},card('x'.repeat(3999))]]){
 await createReposter(user,()=>{},owners)(message,{flags:32768,components});assert.deepEqual(calls,[]);
 }
});
test('five-link edits preserve text and controls, and oversized edits fail before mutation',async()=>{
 const text=urls.slice(0,5).join(' '),current={components:[{type:10,content:text},...Array.from({length:5},()=>card())],attachments:new Map()};
 const edited=await buildEditedPost(current,'Edited '+text,{modes});assert.equal(edited.components[0].content,'Edited '+text);assert.equal(edited.components.filter(c=>c.type===17).length,5);assert.deepEqual(edited.allowedMentions.parse,[]);
 const large={...current,components:[{type:10,content:text},card('x'.repeat(3999))]};await assert.rejects(buildEditedPost(large,'Edited '+text,{modes}),/budget/);
});
test('overlong provider text rejects instead of falling back to a different preview route',async()=>{
 const links=Array.from({length:5},(_,i)=>`https://twitter.com/example/status/${i+1}`);
 const embeds=links.map(url=>({url,description:'x'.repeat(1000)}));
 await assert.rejects(simplePayload(links.join(' '),modes,embeds,async()=>new Response('',{status:403})),/budget/);
});

test('provider budget rejection never falls through to helper replacement',async()=>{
 const {createHandler}=await import('../../src/handler.js');const calls=[];
 const handle=createHandler({channelIds:new Set(),modes,repostEnabled:true},{canSend:()=>true,expandLinks:async s=>s,makeCardPayload:async()=>{throw Error('Card text budget');},repost:()=>calls.push('repost'),log:c=>calls.push(c)});
 const message={id:'sample',guildId:'guild',channelId:'channel',channel:{type:0,send:()=>calls.push('send')},author:{id:'person'},content:urls[0],embeds:[{url:urls[0],description:'metadata'}]};
 await handle(message);assert.deepEqual(calls,['preview_send_failed']);
});
