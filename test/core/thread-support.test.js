import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PermissionFlagsBits as P} from 'discord.js';
import {canRepost,createReposter} from '../../src/repost.js';
import {createHandler} from '../../src/handler.js';
import {canSendPreview} from '../../src/permissions.js';
import {createManagementHandler} from '../../src/manage-post.js';
import {createEditHandler} from '../../src/edit-post.js';
import {openOwnershipStore} from '../../src/ownership.js';
import {createPermissionCheck} from '../../src/permission-check.js';
const guildId='111111111111111111',parentId='222222222222222222',threadId='333333333333333333',sourceId='444444444444444444',targetId='555555555555555555',ownerId='666666666666666666',authorId='777777777777777777',replacementId='888888888888888888',hookId='999999999999999999',bot={id:'111111111111111112'};
const config={repostEnabled:true,channelIds:new Set(),modes:{instagram:'oginstagram'}};
const card=()=>({flags:32768,components:[{type:17,components:[{type:10,content:'Title'},{type:12,items:[{media:{url:'https://example.org/photo.jpg'}}]}]}]});
function fixture(parentType=0,reply=false){
 const calls=[];let row;let current;const denied=new Set(),parentDenied=new Set();
 const has=(deny,bits)=>(Array.isArray(bits)?bits:[bits]).every(b=>!deny.has(b));
 const parent={id:parentId,guildId,type:parentType,permissionsFor:()=>({has:p=>has(parentDenied,p)}),fetchWebhooks:async()=>[hook],createWebhook:async()=>{calls.push('create-hook');return hook;}};
 const channel={id:threadId,guildId,parentId,parent,type:11,archived:false,locked:false,isTextBased:()=>true,isSendable:()=>true,isThread:()=>true,permissionsFor:()=>({has:p=>has(denied,p)})};
 channel.guild={channels:{fetch:async id=>id===threadId?channel:id===parentId?parent:null}};
 const source={id:sourceId,guildId,channelId:threadId,channel,type:reply?19:0,deletable:true,content:'https://www.instagram.com/p/Abc123',author:{id:ownerId,username:'owner'},delete:async()=>calls.push('source-deleted')};
 if(reply)source.reference={type:0,guildId,channelId:threadId,messageId:targetId};
 const target={id:targetId,guildId,channelId:threadId,author:{id:authorId,username:'target'},content:'target text'};
 channel.messages={fetch:async({message:id})=>id===sourceId?source:id===targetId?target:id===replacementId?current:null};
 const hook={id:hookId,channelId:parentId,applicationId:bot.id,owner:bot,name:'Link Embedder Reposts',token:'fixture',send:async payload=>{calls.push(['send',payload]);current={id:replacementId,guildId,channelId:threadId,webhookId:hookId,components:payload.components,attachments:new Map()};return current;},deleteMessage:async(id,destination)=>calls.push(['delete',id,destination]),editMessage:async(id,payload)=>{calls.push(['edit',id,payload]);current={...current,components:payload.components};}};
 const store={put:async(id,r)=>{row=r;calls.push('saved');},get:()=>row,remove:async()=>{row=null;calls.push('removed');}};
 return {calls,parent,channel,source,target,hook,store,denied,parentDenied,get current(){return current;},get row(){return row;},setRow:r=>row=r};
}
async function send(f){return createReposter(bot,()=>{},f.store)(f.source,card());}
function interaction(f,action='menu'){
 const responses=[];
 const i={guildId,channelId:threadId,channel:f.channel,user:{id:ownerId},client:{user:bot},isButton:()=>true,customId:action==='menu'?'manage:open:0':`manage:${action}:${replacementId}`,message:f.current,
 reply:async p=>responses.push(p),deferUpdate:async()=>{},editReply:async p=>responses.push(p),update:async p=>responses.push(p)};
 return {i,responses};
}
test('public text/forum/media threads route ordinary and native replies through parent webhook',async()=>{
 for(const parentType of [0,15,16])for(const reply of [false,true])for(const extra of ['', 'typed @everyone <@123456789012345678> ']){
  const f=fixture(parentType,reply);f.source.content=extra+f.source.content;assert.equal(canRepost(f.source,bot),true);
  const handler=createHandler(config,{canSend:m=>canSendPreview(m,bot)&&canRepost(m,bot),repost:createReposter(bot,()=>{},f.store),expandLinks:async x=>x,makeCardPayload:async()=>card()});
  await handler(f.source);assert.ok(f.calls.includes('source-deleted'));const p=f.calls.find(c=>c[0]==='send')[1];
  assert.equal(p.threadId,threadId);assert.equal(p.threadName,undefined);assert.equal(f.row.channelId,threadId);assert.equal(f.row.webhookChannelId,parentId);
  assert.equal(p.components[reply?1:0].content,f.source.content);assert.deepEqual(p.allowedMentions,reply?{parse:[],users:[authorId],repliedUser:false}:{parse:[],repliedUser:false});
  if(reply)assert.ok(p.components[0].content.includes(`/${threadId}/${targetId})`));
  assert.equal(p.components.at(-1).components[0].accessory.label,'⋯');
 }
});
test('thread starters, attachments, inaccessible/private/locked/archived threads never send',async()=>{
 for(const kind of ['starter','system-starter','has-thread','attachment','private','announcement','archived','locked','parent','guild','cross-reference','permission','parent-permission']){
  const f=fixture(0,true);
  if(kind==='starter')f.source.id=threadId;
  if(kind==='system-starter')f.source.type=21;
  if(kind==='has-thread')f.source.hasThread=true;
  if(kind==='attachment')f.source.attachments={size:1};
  if(kind==='private')f.channel.type=12;
  if(kind==='announcement')f.channel.type=10;
  if(kind==='archived')f.channel.archived=true;
  if(kind==='locked')f.channel.locked=true;
  if(kind==='parent')f.parent.id=targetId;
  if(kind==='guild')f.parent.guildId=targetId;
  if(kind==='cross-reference')f.source.reference.channelId=parentId;
  if(kind==='permission')f.denied.add(P.SendMessagesInThreads);
  if(kind==='parent-permission')f.parentDenied.add(P.ManageWebhooks);
  await send(f);assert.deepEqual(f.calls,[],kind);
 }
});
test('fresh state checks refuse archive/parent changes before send without mutation',async()=>{
 for(const kind of ['archive','parent','missing']){
  const f=fixture();f.parent.fetchWebhooks=async()=>{if(kind==='archive')f.channel.archived=true;if(kind==='parent')f.channel.parentId=targetId;if(kind==='missing')f.channel.guild.channels.fetch=async()=>null;return [f.hook];};
  await send(f);assert.deepEqual(f.calls,[]);
 }
});
test('thread rollback uses exact destination and retains source on send/store/reference failure',async()=>{
 for(const kind of ['send','store','reference','delete']){
  const f=fixture(0,true);if(kind==='send')f.hook.send=async()=>{throw Error('fail');};
  if(kind==='store')f.store.put=async()=>{throw Error('fail');};
  if(kind==='reference'){const original=f.hook.send;f.hook.send=async p=>{const result=await original(p);f.target.channelId=parentId;return result;};}
  if(kind==='delete')f.source.delete=async()=>{throw Error('fail');};
  await send(f);assert.equal(f.calls.includes('source-deleted'),false);
  if(kind!=='send')assert.deepEqual(f.calls.find(c=>c[0]==='delete'),['delete',replacementId,threadId]);
 }
});
test('wrong webhook parent and replacement destination cannot delete original',async()=>{
 const f=fixture();f.hook.channelId=targetId;await send(f);assert.equal(f.calls.includes('source-deleted'),false);assert.equal(f.calls.some(c=>c[0]==='send'),false);
 const g=fixture();g.hook.send=async()=>({id:replacementId,channelId:parentId,guildId});await send(g);assert.equal(g.calls.includes('source-deleted'),false);
});
test('thread ownership survives restart with parent ID and rejects malformed routing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'thread-owner-'));try{
  const path=join(dir,'owners.json'),store=await openOwnershipStore(path);const row={ownerId,guildId,channelId:threadId,webhookId:hookId,webhookChannelId:parentId};await store.put(replacementId,{...row,content:'private',token:'secret'});
  assert.deepEqual((await openOwnershipStore(path)).get(replacementId),row);assert.doesNotMatch(await readFile(path,'utf8'),/private|secret/);
  for(const bad of ['bad',threadId])await assert.rejects(store.put(replacementId,{...row,webhookChannelId:bad}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('thread NSFW and delete controls address the same thread and preserve permissions',async()=>{
 for(const action of ['nsfw','unspoiler','delete']){
  const f=fixture(15,true);await send(f);if(action==='unspoiler')f.current.components.at(-1).components[1].items[0].spoiler=true;const {i,responses}=interaction(f,action);await createManagementHandler(f.store,config)(i);
  if(action!=='delete'){const edit=f.calls.find(c=>c[0]==='edit')[2];assert.equal(edit.threadId,threadId);assert.deepEqual(edit.allowedMentions,{parse:[],repliedUser:false});assert.equal(edit.components[0].content,f.current.components[0].content);assert.equal(edit.components.at(-1).components[1].items[0].spoiler,action==='nsfw');}
  else{assert.deepEqual(f.calls.find(c=>c[0]==='delete'),['delete',replacementId,threadId]);assert.equal(f.row,null);}
  assert.ok(responses.length);
 }
});
test('thread controls reject wrong owner/context/parent and inaccessible thread',async()=>{
 for(const kind of ['owner','channel','parent','archived']){
  const f=fixture();await send(f);const {i}=interaction(f,'delete');
  if(kind==='owner')i.user.id=authorId;if(kind==='channel')i.channelId=parentId;if(kind==='parent')f.setRow({...f.row,webhookChannelId:targetId});if(kind==='archived')f.channel.archived=true;
  await createManagementHandler(f.store,config)(i);assert.equal(f.calls.some(c=>c[0]==='delete'),false);assert.ok(f.row);
 }
});
test('thread edits keep reply link, destination, and no-repeat mention protections',async()=>{
 const f=fixture(16,true);await send(f);const calls=[];let modal;
 const edit=createEditHandler(f.store,config,new Set());const base={guildId,channelId:threadId,channel:f.channel,user:{id:ownerId},client:{user:bot},reply:async p=>calls.push(p),deferReply:async()=>{},editReply:async p=>calls.push(p),showModal:async p=>modal=p};
 await edit({...base,isButton:()=>true,customId:`manage:edit:${replacementId}`});assert.ok(modal);
 await edit({...base,isModalSubmit:()=>true,customId:modal.custom_id,fields:{getTextInputValue:()=> 'edited '+f.source.content}});
 const p=f.calls.find(c=>c[0]==='edit')[2];assert.equal(p.threadId,threadId);assert.deepEqual(p.allowedMentions,{parse:[],repliedUser:false});assert.ok(p.components[0].content.includes('Click to see message'));assert.equal(p.components[1].content,'edited '+f.source.content);
});
test('permissions command distinguishes thread and parent requirements without access expansion',async()=>{
 const f=fixture(15);const responses=[],member={permissions:{has:()=>true}};f.denied.add(P.SendMessagesInThreads);f.parentDenied.add(P.ManageWebhooks);
 const botPerm=f.channel.permissionsFor;f.channel.permissionsFor=u=>u===member?{has:()=>true}:botPerm(u);
 const i={isChatInputCommand:()=>true,commandName:'permissions',guildId,user:{id:ownerId},channel:f.channel,options:{getChannel:()=>null},guild:{channels:f.channel.guild.channels,members:{fetch:async()=>member,fetchMe:async()=>bot}},deferReply:async p=>responses.push(p),editReply:async p=>responses.push(p)};
 await createPermissionCheck(config)(i);assert.equal(responses[0].flags,64);assert.match(responses[1].content,/Send Messages in Threads/);assert.match(responses[1].content,/Manage Webhooks \(parent\)/);assert.deepEqual(f.calls,[]);
});

test('thread menu validates application ownership and saved parent route',async()=>{
 const f=fixture();await send(f);const {i,responses}=interaction(f);await createManagementHandler(f.store,config)(i);
 assert.equal(responses[0].flags,64);assert.deepEqual(responses[0].components[0].components.map(c=>c.label),['Edit Post','Delete Post','Mark NSFW']);
 const g=fixture();await send(g);g.hook.channelId=targetId;const bad=interaction(g);await createManagementHandler(g.store,config)(bad.i);assert.equal(bad.responses[0].components,undefined);
});
test('thread target disappearance, source mutation, and ambiguous deletion retain at least one copy',async()=>{
 for(const kind of ['target-missing','source-attachment','ambiguous-delete']){
  const f=fixture(0,true),originalSend=f.hook.send;f.hook.send=async p=>{const result=await originalSend(p);
   if(kind==='target-missing'){const fetch=f.channel.messages.fetch;f.channel.messages.fetch=async opts=>opts.message===targetId?null:fetch(opts);}
   if(kind==='source-attachment')f.source.attachments={size:1};
   if(kind==='ambiguous-delete')f.source.delete=async()=>{const fetch=f.channel.messages.fetch;f.channel.messages.fetch=async opts=>{if(opts.message===sourceId)throw Error('gone');return fetch(opts);};throw Error('response lost');};
   return result;};
  await send(f);assert.equal(f.calls.includes('source-deleted'),false);
  assert.equal(f.calls.some(c=>c[0]==='delete'),kind!=='ambiguous-delete');
 }
});
test('thread archived while edit modal is open cannot be edited or implicitly reopened',async()=>{
 const f=fixture();await send(f);let modal;const edit=createEditHandler(f.store,config,new Set());
 const base={guildId,channelId:threadId,channel:f.channel,user:{id:ownerId},client:{user:bot},reply:async()=>{},deferReply:async()=>{},editReply:async()=>{},showModal:async p=>modal=p};
 await edit({...base,isButton:()=>true,customId:`manage:edit:${replacementId}`});assert.ok(modal);f.channel.archived=true;
 await edit({...base,isModalSubmit:()=>true,customId:modal.custom_id,fields:{getTextInputValue:()=> 'edited '+f.source.content}});assert.equal(f.calls.some(c=>c[0]==='edit'),false);
});

test('thread send requires every effective permission without requiring parent Send Messages',async()=>{
 for(const bit of [P.ViewChannel,P.SendMessagesInThreads,P.EmbedLinks,P.ReadMessageHistory,P.ManageMessages]){const f=fixture();f.denied.add(bit);await send(f);assert.deepEqual(f.calls,[]);}
 const f=fixture();f.parentDenied.add(P.SendMessages);await send(f);assert.ok(f.calls.includes('source-deleted'));
});
test('thread control failure preserves ownership and source attachments never enter replacement',async()=>{
 const f=fixture();await send(f);f.hook.deleteMessage=async()=>{throw Error('failed');};const {i,responses}=interaction(f,'delete');await createManagementHandler(f.store,config)(i);assert.ok(f.row);assert.match(responses.at(-1).content,/could not confirm/);
 const g=fixture();g.source.attachments={size:1};await send(g);assert.deepEqual(g.calls,[]);
});
test('thread permission check does not disclose details to an inaccessible invoker',async()=>{
 const f=fixture(),responses=[],member={permissions:{has:()=>false}},botPerm=f.channel.permissionsFor;
 f.channel.permissionsFor=u=>u===member?{has:()=>false}:botPerm(u);
 const i={isChatInputCommand:()=>true,commandName:'permissions',guildId,user:{id:ownerId},channel:f.channel,options:{getChannel:()=>null},guild:{channels:f.channel.guild.channels,members:{fetch:async()=>member,fetchMe:async()=>bot}},deferReply:async()=>{},editReply:async p=>responses.push(p)};
 await createPermissionCheck(config)(i);assert.match(responses[0].content,/You need access/);assert.doesNotMatch(responses[0].content,/Missing bot|parent-channel permissions/);
});

test('a user-reopened thread works even when incoming message has stale archived channel state',async()=>{
 const f=fixture(0,true),stale={...f.channel,archived:true};f.source.channel=stale;
 const fetch=f.channel.messages.fetch;f.channel.messages.fetch=async options=>options.message===sourceId?{...f.source,channel:f.channel}:fetch(options);
 const handler=createHandler(config,{canSend:m=>canSendPreview(m,bot)&&canRepost(m,bot),repost:createReposter(bot,()=>{},f.store),expandLinks:async x=>x,makeCardPayload:async()=>card()});
 await handler(f.source);assert.ok(f.calls.includes('source-deleted'));assert.equal(f.calls.find(c=>c[0]==='send')[1].threadId,threadId);assert.equal(stale.archived,true);
});
test('archive refresh never reopens a still-archived, locked, inaccessible, or different thread',async()=>{
 for(const kind of ['archived','locked','missing','different']){
 const f=fixture(),stale={...f.channel,archived:true};f.source.channel=stale;
 if(kind==='archived')f.channel.archived=true;if(kind==='locked')f.channel.locked=true;
 const fetch=f.channel.guild.channels.fetch;if(kind==='missing')stale.guild={channels:{fetch:async()=>{throw Error('inaccessible');}}};
 if(kind==='different')stale.guild={channels:{fetch:async id=>id===threadId?{...f.channel,id:targetId}:fetch(id)}};
 const handler=createHandler(config,{canSend:m=>canSendPreview(m,bot)&&canRepost(m,bot),repost:createReposter(bot,()=>{},f.store),expandLinks:async x=>x,makeCardPayload:async()=>card()});
 await handler(f.source);assert.deepEqual(f.calls,[],kind);
 }
});
