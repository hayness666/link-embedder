import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openOwnershipStore} from '../src/ownership.js';
import {createManagementHandler,managementMenu,spoilerComponents,COMMAND} from '../src/manage-post.js';
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
  reply:async p=>calls.push(p),update:async p=>calls.push(p),deferUpdate:async()=>{},editReply:async p=>calls.push(p)};
 return {calls,store,interaction,hook};
}
test('all actions reject other users before message or webhook access',async()=>{
 for(const action of ['menu','delete','nsfw','dismiss']){const f=fixture(action);f.interaction.user.id='wrong';await createManagementHandler(f.store,config)(f.interaction);assert.equal(f.calls.length,1);assert.equal(f.calls[0].flags,64);assert.match(f.calls[0].content,/Only the original poster/);}
});
test('scope and missing ownership fail closed',async()=>{
 for(const patch of [{guildId:'wrong'},{channelId:'wrong'}]){const f=fixture();Object.assign(f.interaction,patch);await createManagementHandler(f.store,config)(f.interaction);assert.match(f.calls[0].content,/Only the original poster/);}
 const f=fixture();f.store.get=()=>null;await createManagementHandler(f.store,config)(f.interaction);assert.equal(f.calls.length,1);
});
test('private menu labels and reopening directions match the requested flow',()=>{
 const menu=managementMenu(id);assert.equal(menu.flags,64);assert.deepEqual(menu.components[0].components.map(c=>c.label),['Delete post','Mark NSFW','Dismiss']);assert.match(menu.content,/go to the post, open its options, choose \*\*Apps\*\*, then \*\*Manage my post\*\*/);
});
test('dismiss keeps ownership and allows reopening',async()=>{const f=fixture('dismiss');await createManagementHandler(f.store,config)(f.interaction);assert.deepEqual(f.store.get(id),row);assert.deepEqual(f.calls[0].components,[]);});
test('owner deletion removes the record only after confirmed webhook delete',async()=>{const f=fixture('delete');await createManagementHandler(f.store,config)(f.interaction);assert.deepEqual(f.calls.slice(0,3),['fetch','delete','remove']);assert.equal(f.store.get(id),null);});
test('spoiler covers gallery media without changing caption or permitting mentions',async()=>{const f=fixture('nsfw');await createManagementHandler(f.store,config)(f.interaction);const payload=f.calls[1];assert.equal(payload.components[0].components[1].items[0].spoiler,true);assert.equal(payload.components[0].components[0].content,'Caption remains');assert.deepEqual(payload.allowedMentions.parse,[]);assert.equal(payload.components[0].components[1].items[0].media.proxy_url,undefined);assert.equal(spoilerComponents([{type:10,content:'native'}]),null);});
test('failed delete preserves ownership and avoids claiming success',async()=>{const f=fixture('delete');f.hook.deleteMessage=async()=>{throw Error('secret');};await createManagementHandler(f.store,config)(f.interaction);assert.deepEqual(f.store.get(id),row);assert.match(f.calls.at(-1).content,/could not confirm/);});
