import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openOwnershipStore} from '../../src/ownership.js';
import {createManagementHandler,managementMenu,spoilerComponents,COMMAND} from '../../src/manage-post.js';
const id='111111111111111111', ownerId='222222222222222222', guildId='333333333333333333', channelId='444444444444444444', webhookId='555555555555555555';
const row={ownerId,guildId,channelId,webhookId};
const config={testGuildId:guildId,channelIds:new Set([channelId])};
test('ownership survives restart, serializes writes, and retains IDs only',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'embed-owner-')); const path=join(dir,'owners.json');
 try {const store=await openOwnershipStore(path);await Promise.all([store.put(id,{...row,token:'secret',content:'private'}),store.put('666666666666666666',row)]);
 const saved=await openOwnershipStore(path);assert.deepEqual(saved.get(id),row);assert.deepEqual(saved.get('666666666666666666'),row);
 assert.doesNotMatch(await readFile(path,'utf8'),/secret|private|token|content/); await saved.remove(id);assert.equal((await openOwnershipStore(path)).get(id),null);
 await writeFile(path,'bad');await assert.rejects(openOwnershipStore(path),/ownership_store_unavailable/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
function fixture(action='menu') {
 const calls=[];let record={...row};
 const store={get:()=>record,remove:async()=>{calls.push('remove');record=null;}};
 const components=[{type:17,components:[{type:10,content:'Caption remains'},{type:12,items:[{media:{url:'https://example.org/video.mp4',proxy_url:'https://proxy.invalid'},description:'Clip'}]}]}];
 const hook={id:webhookId,owner:{id:'bot'},token:'test',deleteMessage:async()=>calls.push('delete'),editMessage:async(_,payload)=>calls.push(payload)};
 const interaction={isMessageContextMenuCommand:()=>action==='menu',isButton:()=>action!=='menu',commandName:COMMAND,targetId:id,customId:`manage:${action}:${id}`,user:{id:ownerId},guildId,channelId,client:{user:{id:'bot'}},
  channel:{messages:{fetch:async()=>{calls.push('fetch');return {webhookId,components};}},fetchWebhooks:async()=>[hook]},
  deferReply:async p=>calls.push(p),reply:async p=>calls.push(p),update:async p=>calls.push(p),deferUpdate:async()=>{},editReply:async p=>calls.push(p)};
 return {calls,store,interaction,hook,components};
}
test('non-owner can open NSFW-only menu and mark media, but cannot delete',async()=>{
 const menu=fixture();menu.interaction.user.id='other';await createManagementHandler(menu.store,config)(menu.interaction);assert.deepEqual(menu.calls.at(-1).components[0].components.map(c=>c.label),['Mark NSFW']);assert.equal(menu.calls[0].flags,64);
 const f=fixture('nsfw');f.interaction.user.id='other';await createManagementHandler(f.store,config)(f.interaction);assert.equal(f.calls[1].components[0].components[1].items[0].spoiler,true);assert.deepEqual(f.store.get(id),row);
 const d=fixture('delete');d.interaction.user.id='other';await createManagementHandler(d.store,config)(d.interaction);assert.equal(d.calls.length,1);assert.match(d.calls[0].content,/Only the original poster can delete/);assert.deepEqual(d.store.get(id),row);
});
test('scope and missing ownership fail closed',async()=>{
 for(const patch of [{guildId:'wrong'},{channelId:'wrong'}]){const f=fixture();Object.assign(f.interaction,patch);await createManagementHandler(f.store,config)(f.interaction);assert.match(f.calls[0].content,/cannot be managed here/);}
 const f=fixture();f.store.get=()=>null;await createManagementHandler(f.store,config)(f.interaction);assert.equal(f.calls.length,1);
});
test('private menu labels and reopening directions match the requested flow',()=>{
 const menu=managementMenu(id);assert.equal(menu.flags,64);assert.equal(menu.content,undefined);assert.deepEqual(menu.components[0].components.map(c=>c.label),['Edit Post','Delete Post','Mark NSFW']);assert.equal(menu.components[0].components.find(c=>c.label==='Mark NSFW').style,1);assert.deepEqual(menu.components[0].components.find(c=>c.label==='Edit Post'),{type:2,style:3,label:'Edit Post',custom_id:`manage:edit:${id}`});assert.equal(menu.components[0].components.find(c=>c.label==='Delete Post').style,4);
});
test('dismiss keeps ownership and allows reopening',async()=>{const f=fixture('dismiss');await createManagementHandler(f.store,config)(f.interaction);assert.deepEqual(f.store.get(id),row);assert.deepEqual(f.calls[0].components,[]);});
test('owner deletion removes the record only after confirmed webhook delete',async()=>{const f=fixture('delete');await createManagementHandler(f.store,config)(f.interaction);assert.deepEqual(f.calls.slice(0,3),['fetch','delete','remove']);assert.equal(f.store.get(id),null);});
test('spoiler covers gallery media without changing caption or permitting mentions',async()=>{const f=fixture('nsfw');await createManagementHandler(f.store,config)(f.interaction);const payload=f.calls[1];assert.equal(payload.components[0].components[1].items[0].spoiler,true);assert.equal(payload.components[0].components[0].content,'Caption remains');assert.deepEqual(payload.allowedMentions,{parse:[],repliedUser:false});assert.equal(payload.components[0].components[1].items[0].media.proxy_url,undefined);assert.equal(spoilerComponents([{type:10,content:'native'}]),null);});
test('failed delete preserves ownership and avoids claiming success',async()=>{const f=fixture('delete');f.hook.deleteMessage=async()=>{throw Error('secret');};await createManagementHandler(f.store,config)(f.interaction);assert.deepEqual(f.store.get(id),row);assert.match(f.calls.at(-1).content,/could not confirm/);});

test('public configuration permits matching saved records across guilds but rejects cross-guild actions',async()=>{
 const publicConfig={testGuildId:null,channelIds:new Set()};
 const f=fixture('nsfw');f.interaction.user.id='other';await createManagementHandler(f.store,publicConfig)(f.interaction);assert.equal(f.calls[1].components[0].components[1].items[0].spoiler,true);
 const wrong=fixture('delete');wrong.interaction.guildId='another';await createManagementHandler(wrong.store,publicConfig)(wrong.interaction);assert.equal(wrong.calls.length,1);assert.match(wrong.calls[0].content,/cannot be managed here/);
});

test('successful NSFW notice retains useful explanation without obsolete Apps directions',async()=>{const f=fixture('nsfw');await createManagementHandler(f.store,config)(f.interaction);assert.equal(f.calls.at(-1).content,'Photos/videos are now covered as spoilers. The caption and link remain visible. This does not age-restrict the post or channel.');assert.deepEqual(f.calls.at(-1).components,[]);});

test('owner sees Remove spoiler from fresh state, while other users can only mark',async()=>{
 for(const owner of [true,false]){const f=fixture();f.components[0].components[1].items[0].spoiler=true;if(!owner)f.interaction.user.id='other';await createManagementHandler(f.store,config)(f.interaction);const buttons=f.calls.at(-1).components[0].components;assert.equal(buttons.at(-1).label,owner?'Remove spoiler':'Mark NSFW');}
});
test('owner removal clears mixed gallery spoilers without altering text, links, or controls',async()=>{
 const f=fixture('unspoiler');const items=f.components[0].components[1].items;items[0].spoiler=true;items.push({media:{url:'https://example.org/photo.jpg'},spoiler:false});
 await createManagementHandler(f.store,config)(f.interaction);const payload=f.calls[1];assert.ok(payload.components[0].components[1].items.every(i=>i.spoiler===false));assert.equal(payload.components[0].components[0].content,'Caption remains');assert.equal(payload.components[0].components[1].items[0].media.url,items[0].media.url);assert.deepEqual(payload.allowedMentions,{parse:[],repliedUser:false});assert.deepEqual(f.store.get(id),row);assert.match(f.calls.at(-1).content,/removed/);
});
test('forged non-owner, stale unmarked action, and changed ownership cannot remove spoilers',async()=>{
 const f=fixture('unspoiler');f.interaction.user.id='other';await createManagementHandler(f.store,config)(f.interaction);assert.equal(f.calls.length,1);assert.match(f.calls[0].content,/Only the original/);
 const g=fixture('unspoiler');await createManagementHandler(g.store,config)(g.interaction);assert.equal(g.calls.length,2);assert.match(g.calls.at(-1).content,/No changes/);
 const h=fixture('unspoiler');h.components[0].components[1].items[0].spoiler=true;let reads=0;h.store.get=()=>++reads===1?row:{...row,ownerId:'other'};await createManagementHandler(h.store,config)(h.interaction);assert.match(h.calls.at(-1).content,/could not confirm/);assert.equal(h.calls.length,2);
});

test('menu defers privately before delayed fetch and completes with editReply',async()=>{
 for(const viaButton of [false,true]){
  const f=fixture();let release;const blocked=new Promise(resolve=>{release=resolve;});let ack=false;
  f.interaction.deferReply=async p=>{assert.equal(p.flags,64);ack=true;};
  f.interaction.reply=async()=>assert.fail('must use deferred response');
  f.interaction.channel.messages.fetch=async()=>{assert.equal(ack,true);await blocked;return {webhookId,components:f.components};};
  if(viaButton){f.interaction.isMessageContextMenuCommand=()=>false;f.interaction.isButton=()=>true;f.interaction.customId='manage:open:0';f.interaction.message={id,webhookId};f.hook.applicationId='bot';f.interaction.channel.fetchWebhooks=async()=>{assert.equal(ack,true);await blocked;return [f.hook];};}
  const pending=createManagementHandler(f.store,config)(f.interaction);await new Promise(resolve=>setImmediate(resolve));assert.equal(ack,true);assert.equal(f.calls.length,0);release();await pending;
  assert.equal(f.calls.at(-1).flags,undefined);assert.equal(f.calls.at(-1).components[0].components[0].label,'Edit Post');
 }
});
test('post-defer lookup and webhook failures edit the private response without exposing controls',async()=>{
 for(const fail of ['message','webhook']){
  const f=fixture();let ack=false;f.interaction.deferReply=async()=>{ack=true;};f.interaction.reply=async()=>assert.fail('cannot reply twice');
  if(fail==='message')f.interaction.channel.messages.fetch=async()=>{assert.ok(ack);throw Error('secret');};
  else{f.interaction.isMessageContextMenuCommand=()=>false;f.interaction.isButton=()=>true;f.interaction.customId='manage:open:0';f.interaction.message={id,webhookId};f.interaction.channel.fetchWebhooks=async()=>{assert.ok(ack);throw Error('secret');};}
  await createManagementHandler(f.store,config)(f.interaction);assert.match(f.calls.at(-1).content,/cannot be managed/);assert.equal(f.calls.at(-1).components,undefined);assert.doesNotMatch(JSON.stringify(f.calls),/secret/);
 }
});
