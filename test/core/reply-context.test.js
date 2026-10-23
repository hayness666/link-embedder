import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canRepost,createReposter} from '../../src/repost.js';
import {buildEditedPost,editableSource} from '../../src/edit-post.js';
import {withCardControls} from '../../src/card-controls.js';
import {spoilerComponents} from '../../src/manage-post.js';
import {openOwnershipStore} from '../../src/ownership.js';
import {replyReferenceId,resolveReplyContext,preservedReplyNote,checkReplyBudget,replyNoteComponents,USER_TEXT_COMPONENT_ID} from '../../src/reply-context.js';
const guildId='111111111111111111',channelId='222222222222222222',messageId='333333333333333333',targetId='444444444444444444',authorId='555555555555555555',ownerId='666666666666666666',hookId='777777777777777777',bot={id:'888888888888888888'};
const card=()=>({type:17,components:[{type:10,content:'Title'},{type:12,items:[{media:{url:'https://example.org/image.jpg'}}]}]});
function fixture(){
 const events=[];let record;
 const target={id:targetId,guildId,channelId,author:{id:authorId,username:'actual_user'},content:'A short target message'};
 const message={id:messageId,type:19,guildId,channelId,deletable:true,content:'https://www.instagram.com/p/Abc123',author:{id:ownerId,username:'Sender'},reference:{type:0,guildId,channelId,messageId:targetId},delete:async()=>events.push('delete')};
 const hook={id:hookId,owner:bot,applicationId:bot.id,name:'Link Embedder Reposts',token:'test',send:async payload=>{events.push(payload);return {id:'999999999999999999'};},deleteMessage:async()=>events.push('rollback')};
 message.channel={type:0,permissionsFor:()=>({has:()=>true}),fetchWebhooks:async()=>[hook],messages:{fetch:async({message:id})=>id===targetId?target:message}};
 const store={put:async(id,row)=>{record=row;events.push('saved');},remove:async()=>{record=null;events.push('removed');}};
 return {message,target,hook,store,events,get row(){return record;}};
}
test('same-channel reply replaces only after target validation and stores reference IDs only',async()=>{
 const f=fixture();await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});
 assert.deepEqual(f.events.slice(1),['saved','delete']);const payload=f.events[0];
 assert.equal(payload.components[1].content,f.message.content);
 assert.equal(payload.components[0].content,`-# ↪︎ **<@${authorId}>** *[Click to see message](https://discord.com/channels/${guildId}/${channelId}/${targetId})*`);
 assert.equal(payload.components[2].components[0].accessory.label,'⋯');assert.deepEqual(payload.allowedMentions,{parse:[],users:[authorId],repliedUser:false});
 assert.equal(f.row.ownerId,ownerId);assert.equal(f.row.replyMessageId,targetId);assert.doesNotMatch(JSON.stringify(payload)+JSON.stringify(f.row),/PRIVATE BODY/);
});
test('malformed, cross-channel, attachment, thread, and noncustom replies are left untouched',async()=>{
 for(const change of [{reference:null},{reference:{guildId,channelId,messageId:'bad'}},{reference:{guildId,channelId:'999999999999999999',messageId:targetId}},{attachments:{size:1}},{channel:{type:11}},{channel:{type:12}},{hasThread:true}]){
 const f=fixture();Object.assign(f.message,change);assert.equal(canRepost(f.message,bot),false);assert.equal(await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]}),false);assert.deepEqual(f.events,[]);
 }
 const f=fixture();await createReposter(bot,()=>{},f.store)(f.message,{content:'helper'});assert.deepEqual(f.events,[]);
});
test('missing and mismatched target preserves original without a send',async()=>{
 for(const kind of ['missing','channel','author','username']){
 const f=fixture();if(kind==='missing')f.message.channel.messages.fetch=async()=>{throw Error('private error');};
 if(kind==='channel')f.target.channelId='999999999999999999';if(kind==='author')f.target.author.id='bad';if(kind==='username')f.target.author.username='evil\nname';
 const logs=[];await createReposter(bot,x=>logs.push(x),f.store)(f.message,{flags:32768,components:[card()]});assert.deepEqual(f.events,[]);assert.deepEqual(logs,['repost_failed_original_preserved_or_delete_unconfirmed']);
 }
});
test('target deletion after send rolls replacement back and preserves original',async()=>{
 const f=fixture();let reads=0;f.message.channel.messages.fetch=async({message:id})=>{if(id===targetId&&++reads===2)throw Error('gone');return id===targetId?f.target:f.message;};
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.deepEqual(f.events.slice(1),['saved','rollback','removed']);
});
test('reply reference change after send preserves original',async()=>{
 const f=fixture();const send=f.hook.send;f.hook.send=async p=>{const result=await send(p);f.message.reference={...f.message.reference,messageId:'999999999999999998'};return result;};
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.deepEqual(f.events.slice(1),['saved','rollback','removed']);
});
test('reply note survives text and link edits, spoilers, and controls without entering edit source',async()=>{
 const f=fixture(),context=await resolveReplyContext(f.message),row={ownerId,guildId,channelId,webhookId:hookId,replyMessageId:targetId};
 const current={components:[...replyNoteComponents(context.note),{type:10,content:f.message.content},...withCardControls([card()])],attachments:new Map()};
 assert.equal(editableSource(current,row).text,f.message.content);
 for(const text of ['hello '+f.message.content,'https://www.instagram.com/p/Def456']){
 const payload=await buildEditedPost(current,text,{modes:{instagram:'oginstagram'}},{ownershipRow:row,expand:async x=>x,render:async()=>({flags:32768,components:[{type:10,content:'source'},card()]})});
 assert.deepEqual(payload.allowedMentions,{parse:[],repliedUser:false});assert.deepEqual(payload.components.map(c=>c.type),[10,10,17]);assert.equal(payload.components[1].content,text);assert.deepEqual(payload.components[0],context.note);assert.equal(payload.components[2].components[0].accessory.label,'⋯');assert.deepEqual(spoilerComponents(payload.components)[0],context.note);
 }
 assert.throws(()=>preservedReplyNote({...current,components:[current.components[0],{type:14,divider:true,spacing:1}]},row));
});
test('attribution uses validated user ID instead of source formatting, budgets include note, IDs persist without names or bodies',async()=>{
 const f=fixture();f.target.author.username='a[evil](url)';const context=await resolveReplyContext(f.message);assert.ok(context.note.content.startsWith(`-# ↪︎ **<@${authorId}>** *[`));assert.doesNotMatch(context.note.content,/evil/);
 assert.throws(()=>checkReplyBudget([{type:10,content:'x'.repeat(4000)},context.note]),/budget/);
 const dir=await mkdtemp(join(tmpdir(),'reply-owner-'));try{const path=join(dir,'owners.json'),store=await openOwnershipStore(path);await store.put(messageId,{ownerId,guildId,channelId,webhookId:hookId,replyMessageId:targetId,username:'private',body:'private'});assert.equal((await openOwnershipStore(path)).get(messageId).replyMessageId,targetId);assert.doesNotMatch(await readFile(path,'utf8'),/private|username|body/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('reference lookup times out without sending or deleting',async()=>{
 const f=fixture();f.message.channel.messages.fetch=async()=>new Promise(()=>{});
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.deepEqual(f.events,[]);
});
test('send and ownership failures retain original reply',async()=>{
 for(const kind of ['send','store']){const f=fixture();if(kind==='send')f.hook.send=async()=>{throw Error('failed');};else f.store.put=async()=>{throw Error('disk');};await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.equal(f.events.includes('delete'),false);}
});
test('reply component overflow fails before webhook send',async()=>{
 const f=fixture();await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:Array.from({length:14},card)});assert.deepEqual(f.events,[]);
});
test('reference metadata rejects forwards, cross-guild targets, and self-reference',()=>{
 for(const patch of [{type:1},{guildId:'999999999999999999'},{messageId}]){const f=fixture();Object.assign(f.message.reference,patch);assert.equal(replyReferenceId(f.message),null);}
});
test('source changes during second reference lookup preserve original',async()=>{
 const f=fixture();let targets=0;const initial=f.message.content;
 f.message.channel.messages.fetch=async({message:id})=>{
  if(id===targetId){if(++targets===2)f.message.channel.messages.fetch=async()=>({...f.message,content:'changed'});return f.target;}
  return {...f.message,content:initial};
 };
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.equal(f.events.includes('delete'),false);assert.ok(f.events.includes('rollback'));
});

test('normal handler dispatch admits a validated reply and keeps attachments excluded',async()=>{
 const {createHandler}=await import('../../src/handler.js');
 for(const attachments of [false,true]){
  const f=fixture();if(attachments)f.message.attachments={size:1};
  const config={modes:{instagram:'card'},repostEnabled:true,channelIds:new Set(),testGuildId:null};
  const handler=createHandler(config,{canSend:m=>canRepost(m,bot),repost:createReposter(bot,()=>{},f.store),expandLinks:async x=>x,makeCardPayload:async()=>({flags:32768,components:[{type:10,content:f.message.content},card()]})});
  await handler(f.message);assert.equal(f.events.includes('delete'),!attachments);
 }
});

test('validated same-channel replies are eligible in voice text chat',()=>{const f=fixture();f.message.channel.type=2;assert.ok(replyReferenceId(f.message));assert.equal(canRepost(f.message,bot),true);});

test('post-send reference failure plus rollback failure can leave both copies and emits cleanup warning',async()=>{
 const f=fixture();let reads=0;const logs=[];
 f.message.channel.messages.fetch=async({message:id})=>{if(id===targetId&&++reads===2)throw Error('target unavailable');return id===targetId?f.target:f.message;};
 f.hook.deleteMessage=async()=>{throw Error('rollback unavailable');};
 await createReposter(bot,x=>logs.push(x),f.store)(f.message,{flags:32768,components:[card()]});
 assert.equal(f.events.includes('delete'),false);assert.ok(f.row);assert.equal(typeof f.events[0],'object');
 assert.deepEqual(logs,['repost_failed_original_preserved_or_delete_unconfirmed','repost_cleanup_unconfirmed']);
});
test('unconfirmed post-send source fetch retains replacement rather than risking deletion of the only copy',async()=>{
 const f=fixture();const logs=[];
 f.message.channel.messages.fetch=async({message:id})=>{if(id===messageId)throw Error('source read unavailable');return f.target;};
 await createReposter(bot,x=>logs.push(x),f.store)(f.message,{flags:32768,components:[card()]});
 assert.equal(f.events.includes('delete'),false);assert.equal(f.events.includes('rollback'),false);assert.ok(f.row);
 assert.deepEqual(logs,['repost_failed_original_preserved_or_delete_unconfirmed','repost_cleanup_unconfirmed']);
});
test('original deletion rejection with working rollback leaves only original',async()=>{
 const f=fixture();f.message.delete=async()=>{throw Error('cannot delete');};const logs=[];
 await createReposter(bot,x=>logs.push(x),f.store)(f.message,{flags:32768,components:[card()]});
 assert.deepEqual(f.events.slice(1),['saved','rollback','removed']);assert.equal(f.row,null);
 assert.deepEqual(logs,['repost_failed_original_preserved_or_delete_unconfirmed']);
});

test('legacy notes remain editable while malformed mention notes and wrong jump targets reject',()=>{
 const row={guildId,channelId,replyMessageId:targetId},url=`https://discord.com/channels/${guildId}/${channelId}/${targetId}`;
 const current=content=>({components:[{type:10,content:'source'},{type:10,content}]});
 const old=`Replying to @old_user · [View message](${url})`;
 assert.equal(preservedReplyNote(current(old),row).content,old);
 for(const tail of ['<@bad>:','<@&555555555555555555>:','<@555555555555555555>: @everyone'])assert.throws(()=>preservedReplyNote(current(`Replying to a [message](${url}) from ${tail}`),row));
 assert.throws(()=>preservedReplyNote(current(`Replying to a [message](${url}0) from <@${authorId}>:`),row));
});

test('initial reply allows only the verified target user, never roles or everyone',async()=>{
 const f=fixture();f.message.content+=' <@123456789012345678> <@&123456789012345678> @everyone';
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});
 assert.deepEqual(f.events[0].allowedMentions,{parse:[],users:[authorId],repliedUser:false});
 assert.equal(f.events[0].allowedMentions.roles,undefined);
});

test('nonreply cards add no reply divider and retain existing card dividers',async()=>{
 const f=fixture();f.message.type=0;delete f.message.reference;
 const original=card();original.components.splice(1,0,{type:14,divider:true,spacing:1});
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[original]});
 const payload=f.events[0];assert.equal(payload.components.length,2);assert.deepEqual(payload.components.map(c=>c.type),[10,17]);
 assert.deepEqual(payload.components[1].components[1],{type:14,divider:true,spacing:1});assert.doesNotMatch(JSON.stringify(payload),/Replying to/);
});
test('missing or invalid reply context cannot emit an orphan divider or empty spacer',async()=>{
 for(const kind of ['missing','invalid']){const f=fixture();if(kind==='missing')f.message.channel.messages.fetch=async()=>null;else f.message.reference.channelId='999999999999999999';
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.deepEqual(f.events,[]);}
 const f=fixture(),row={guildId,channelId,replyMessageId:targetId};
 assert.throws(()=>preservedReplyNote({components:[{type:10,content:'source'},{type:14,divider:true,spacing:1},card()]},row));
 assert.equal(preservedReplyNote({components:[{type:10,content:'source'},card()]},{guildId,channelId}),null);
});

test('subtext uses a text-presentation arrow, bold author, and no trailing colon or divider',async()=>{
 const f=fixture();await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});
 const nodes=f.events[0].components;assert.deepEqual(nodes.map(c=>c.type),[10,10,17]);
 assert.ok(nodes[0].content.startsWith('-# \u21aa\ufe0e **<@'));assert.doesNotMatch(nodes[0].content,/:$/);
 assert.equal(nodes[1].content,f.message.content);
 const row={guildId,channelId,replyMessageId:targetId};
 for(const tail of ['<@bad>','<@&555555555555555555>','<@555555555555555555> @everyone']){
  const altered=structuredClone(nodes);altered[0].content=altered[0].content.replace(/<@\d+>/,tail);
  assert.throws(()=>preservedReplyNote({components:altered},row));
 }
});

test('voice replies preserve text, context, targeted ping, controls, edits, and spoilers',async()=>{
 for(const extra of ['', 'typed text @everyone <@123456789012345678> ']){
  const f=fixture();f.message.channel.type=2;f.message.content=extra+f.message.content;
  await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});
  assert.deepEqual(f.events.slice(1),['saved','delete']);const p=f.events[0];
  assert.deepEqual(p.components.map(c=>c.type),[10,10,17]);assert.equal(p.components[1].content,f.message.content);
  assert.ok(p.components[0].content.includes('/'+targetId+')'));assert.deepEqual(p.allowedMentions,{parse:[],users:[authorId],repliedUser:false});
  const current={components:p.components,attachments:new Map()};
  for(const text of ['edit '+f.message.content,'https://www.instagram.com/p/Def456']){
   const edited=await buildEditedPost(current,text,{modes:{instagram:'oginstagram'}},{ownershipRow:f.row,expand:async x=>x,render:async()=>({flags:32768,components:[{type:10,content:'source'},card()]})});
   assert.deepEqual(edited.allowedMentions,{parse:[],repliedUser:false});assert.deepEqual(edited.components[0],p.components[0]);
   assert.equal(edited.components[2].components[0].accessory.label,'⋯');assert.deepEqual(spoilerComponents(edited.components)[0],p.components[0]);
  }
 }
});
test('voice reply failures and exclusions preserve originals',async()=>{
 for(const kind of ['target','cross-channel','attachment','permission','send','thread']){
  const f=fixture();f.message.channel.type=2;
  if(kind==='target')f.target.channelId='999999999999999999';
  if(kind==='cross-channel')f.message.reference.channelId='999999999999999999';
  if(kind==='attachment')f.message.attachments={size:1};
  if(kind==='permission')f.message.channel.permissionsFor=()=>({has:()=>false});
  if(kind==='send')f.hook.send=async()=>{throw Error('send failed');};
  if(kind==='thread')f.message.channel.type=11;
  await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});assert.deepEqual(f.events,[]);
 }
});

test('previous deployed subtext notes survive source and link edits unchanged',async()=>{
 const f=fixture(),row={ownerId,guildId,channelId,webhookId:hookId,replyMessageId:targetId};
 const note={type:10,content:`-# ↪︎ Replying to a [message](https://discord.com/channels/${guildId}/${channelId}/${targetId}) from <@${authorId}>`};
 const current={components:[note,{type:10,content:f.message.content},...withCardControls([card()])],attachments:new Map()};
 for(const text of ['edit '+f.message.content,'https://www.instagram.com/p/Def456']){
 const p=await buildEditedPost(current,text,{modes:{instagram:'oginstagram'}},{ownershipRow:row,expand:async x=>x,render:async()=>({flags:32768,components:[{type:10,content:'source'},card()]})});
 assert.deepEqual(p.components[0],note);assert.equal(p.components[1].content,text);assert.deepEqual(p.allowedMentions,{parse:[],repliedUser:false});
 }
});

function trackedFixture(text='Human accompanying text https://example.org/post'){
 const f=fixture();f.target.author={id:bot.id,username:'webhook',bot:true};f.target.webhookId=hookId;
 f.target.flags={has:n=>n===32768};f.target.content='';
 f.target.components=[{type:10,id:USER_TEXT_COMPONENT_ID,content:text},card(),{type:10,content:'Generated footer'}];
 const row={ownerId,guildId,channelId,webhookId:hookId,sourceComponentId:USER_TEXT_COMPONENT_ID};
 f.store.get=id=>id===targetId?row:null;return {...f,ownership:row};
}
test('tracked card replies use a constant link and notify the verified owner',async()=>{
 const f=trackedFixture();await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});
 const p=f.events[0];assert.match(p.components[0].content,/Click to see message/);
 assert.doesNotMatch(p.components[0].content,/Generated|Title|example.org/);
 assert.ok(p.components[0].content.includes(`<@${ownerId}>`));assert.ok(p.components[0].content.includes(`/${targetId})`));
 assert.deepEqual(p.allowedMentions.users,[ownerId]);assert.equal(p.components[1].id,USER_TEXT_COMPONENT_ID);assert.ok(f.events.includes('delete'));
});
test('URL-only, legacy, hidden, and ambiguous card sources use neutral message',async()=>{
 for(const mutate of [f=>f.target.components[0].content='https://example.org/post',f=>delete f.ownership.sourceComponentId,f=>f.target.components[0].content='||hidden||',f=>f.target.components[1].components[1].items[0].spoiler=true,f=>f.target.components.push({...f.target.components[0]}),f=>f.target.components.reverse()]){
 const f=trackedFixture();mutate(f);const c=await resolveReplyContext(f.message,f.store);assert.match(c.note.content,/\[Click to see message\]\(https:/);assert.ok(c.note.content.includes(`<@${ownerId}>`));
 }
});
test('unknown automated targets never provide generated excerpts or guessed owners',async()=>{
 const f=trackedFixture();const c=await resolveReplyContext(f.message,{get:()=>null});assert.match(c.note.content,/\[Click to see message\]/);assert.doesNotMatch(c.note.content,/<@/);
});
test('mismatched trusted card ownership fails closed',async()=>{
 for(const key of ['webhookId','guildId','channelId','ownerId']){const f=trackedFixture();f.ownership[key]='bad';await assert.rejects(resolveReplyContext(f.message,f.store),/ownership/);}
});
test('marked source survives both edit paths and spoiler changes without repeated ping',async()=>{
 const f=trackedFixture();for(const text of ['Updated https://example.org/post','Updated https://www.instagram.com/p/Def456']){
 const p=await buildEditedPost(f.target,text,{modes:{instagram:'oginstagram'}},{ownershipRow:f.ownership,expand:async x=>x,render:async()=>({flags:32768,components:[{type:10,content:'source'},card()]})});
 assert.equal(p.components[0].id,USER_TEXT_COMPONENT_ID);assert.deepEqual(p.allowedMentions,{parse:[],repliedUser:false});assert.equal(spoilerComponents(p.components)[0].id,USER_TEXT_COMPONENT_ID);
 }
});
test('ownership persists component provenance without source body',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'card-provenance-'));try{const path=join(dir,'rows.json'),store=await openOwnershipStore(path),f=trackedFixture();await store.put(targetId,{...f.ownership,content:'SECRET BODY'});assert.equal((await openOwnershipStore(path)).get(targetId).sourceComponentId,USER_TEXT_COMPONENT_ID);assert.doesNotMatch(await readFile(path,'utf8'),/SECRET BODY|content/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('replying to a reply-card skips its existing attribution and provider body',async()=>{
 const f=trackedFixture(),prior='123456789012345678';f.ownership.replyMessageId=prior;
 f.target.components.unshift({type:10,content:`-# ↪︎ **<@${authorId}>**: [Prior excerpt](https://discord.com/channels/${guildId}/${channelId}/${prior})`});
 const c=await resolveReplyContext(f.message,f.store);assert.match(c.note.content,/Click to see message/);assert.doesNotMatch(c.note.content,/Prior excerpt/);assert.ok(c.note.content.endsWith(`/${targetId})*`));
});
test('all ordinary and tracked targets use a constant safe linked label',async()=>{
 for(const text of ['ordinary text','', '||secret||', '[evil](https://evil.test) @everyone', String.raw`a\_b`, '😀'.repeat(200)]){
  for(const f of [fixture(),trackedFixture(text)]){
   f.target.content=text;const c=await resolveReplyContext(f.message,f.store);
   const expectedAuthor=f.target.webhookId?ownerId:authorId;
   assert.equal(c.note.content,`-# ↪︎ **<@${expectedAuthor}>** *[Click to see message](https://discord.com/channels/${guildId}/${channelId}/${targetId})*`);
   assert.deepEqual(preservedReplyNote({components:[c.note,{type:10,content:'source'}]},{guildId,channelId,replyMessageId:targetId}),c.note);
  }
 }
});
test('unknown automated author is omitted, never notified, and editable',async()=>{
 const f=trackedFixture();f.store.get=()=>null;
 await createReposter(bot,()=>{},f.store)(f.message,{flags:32768,components:[card()]});
 const p=f.events[0];assert.deepEqual(p.allowedMentions.users,[]);
 assert.equal(p.components[0].content,`-# ↪︎ *[Click to see message](https://discord.com/channels/${guildId}/${channelId}/${targetId})*`);
 assert.deepEqual(preservedReplyNote({components:p.components},{guildId,channelId,replyMessageId:targetId}),p.components[0]);
 assert.ok(f.events.includes('delete'));
});
