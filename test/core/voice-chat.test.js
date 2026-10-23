import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits as P} from 'discord.js';
import {canSendPreview} from '../../src/permissions.js';
import {canRepost,createReposter} from '../../src/repost.js';
import {createHandler} from '../../src/handler.js';
import {createManagementHandler} from '../../src/manage-post.js';
const bot={id:'111111111111111111'},guildId='222222222222222222',channelId='333333333333333333',ownerId='444444444444444444',hookId='555555555555555555',replacement='666666666666666666';
const required=[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ReadMessageHistory,P.ManageMessages,P.ManageWebhooks];
function fixture(){
 const events=[],records=new Map();let allowed=required;
 const channel={id:channelId,type:2,isTextBased:()=>true,isSendable:()=>true,isThread:()=>false,permissionsFor:()=>({has:flags=>flags.every(f=>allowed.includes(f))})};
 const msg={id:'777777777777777777',guildId,channelId,channel,type:0,deletable:true,content:'https://www.instagram.com/p/Abc123',author:{id:ownerId,username:'User'},delete:async()=>events.push('delete')};
 const hook={id:hookId,owner:bot,applicationId:bot.id,name:'Link Embedder Reposts',token:'test',send:async payload=>{events.push(payload);return{id:replacement};},deleteMessage:async()=>events.push('rollback')};
 channel.fetchWebhooks=async()=>{events.push('hooks');return[hook];};channel.messages={fetch:async()=>msg};
 const store={put:async(id,row)=>{records.set(id,row);events.push('saved');},get:id=>records.get(id),remove:async id=>records.delete(id)};
 return{events,records,channel,msg,hook,store,deny:permission=>{allowed=required.filter(p=>p!==permission);}};
}
const preview=()=>({flags:32768,components:[{type:17,components:[{type:10,content:'Title'}]}]});
test('voice chat dispatch sends in same channel and creates ordinary ownership/controls without voice actions',async()=>{
 const f=fixture(),config={channelIds:new Set([channelId]),testGuildId:guildId,repostEnabled:true,modes:{instagram:'card'}};
 await createHandler(config,{canSend:m=>canSendPreview(m,bot)&&canRepost(m,bot),repost:createReposter(bot,()=>{},f.store),expandLinks:async x=>x,makeCardPayload:async()=>preview()})(f.msg);
 assert.deepEqual(f.events.filter(x=>typeof x==='string'),['hooks','saved','delete']);
 const row=f.records.get(replacement);assert.equal(row.channelId,channelId);assert.equal(row.ownerId,ownerId);assert.equal(row.webhookId,hookId);
 const payload=f.events.find(x=>typeof x==='object');assert.equal(payload.components[1].components[0].accessory.label,'⋯');assert.equal(payload.threadId,undefined);
 f.channel.messages.fetch=async()=>({id:replacement,webhookId:hookId,components:payload.components});
 let menu,ack;await createManagementHandler(f.store,config)({isButton:()=>true,customId:'manage:open:0',message:{id:replacement,webhookId:hookId},guildId,channelId,user:{id:ownerId},client:{user:bot},channel:f.channel,deferReply:async p=>{ack=p;},editReply:async p=>{menu=p;},reply:async p=>{menu=p;}});
 assert.equal(ack.flags,64);assert.equal(menu.components[0].components[0].label,'Edit Post');
});
test('all existing permission requirements apply without requiring Connect/Speak',()=>{
 for(const permission of required){const f=fixture();f.deny(permission);assert.equal(canRepost(f.msg,bot),false);}
 const f=fixture();assert.equal(canSendPreview(f.msg,bot),true);assert.equal(canRepost(f.msg,bot),true);
});
test('voice attachments/replies/stage/forum/thread exclusions remain intact',()=>{
 for(const patch of [{attachments:{size:1}},{reference:{}},{type:19},{hasThread:true},{poll:{}},{channel:{type:13}},{channel:{type:15}},{channel:{type:11}},{channel:{type:12}}]){
 const f=fixture();Object.assign(f.msg,patch);assert.equal(canRepost(f.msg,bot),false);
 }
});
test('voice webhook failures preserve original and never fall back to another destination',async()=>{
 for(const kind of ['fetch','send','application']){const f=fixture();if(kind==='fetch')f.channel.fetchWebhooks=async()=>{throw Error('no access');};if(kind==='send')f.hook.send=async()=>{throw Error('failed');};if(kind==='application')f.hook.applicationId=null;
 await createReposter(bot,()=>{},f.store)(f.msg,preview());assert.equal(f.events.includes('delete'),false);assert.equal(f.records.size,0);}
});
test('configured channel restrictions still exclude other voice chats before webhook access',async()=>{
 const f=fixture();await createHandler({channelIds:new Set(['999999999999999999']),modes:{instagram:'card'},repostEnabled:true},{canSend:()=>{throw Error('must not reach');}})(f.msg);assert.deepEqual(f.events,[]);
});
