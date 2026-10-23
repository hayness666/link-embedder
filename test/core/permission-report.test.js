import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits as P,ChannelType} from 'discord.js';
import {createPermissionCheck,REQUIRED_PERMISSIONS} from '../../src/permission-check.js';
function fixture(count=1){
 const member={permissions:{has:p=>p===P.ManageGuild}},bot={},channels=new Map(),threads=new Map(),calls=[];
 for(let n=0;n<count;n++){
  const id=String(100000000000000000n+BigInt(n));
  channels.set(id,{id,guildId:'100000000000000999',type:ChannelType.GuildText,permissionsFor:m=>({has:p=>m===bot?p!==P.ManageWebhooks:true})});
 }
 const i={guildId:'100000000000000999',user:{id:'user'},commandName:'permissions',isChatInputCommand:()=>true,options:{getString:()=> 'server',getInteger:()=>1,getChannel:()=>null},guild:{members:{fetch:async()=>member,fetchMe:async()=>bot},channels:{fetch:async()=>channels,fetchActiveThreads:async()=>({threads})}},deferReply:async x=>calls.push(x),editReply:async x=>calls.push(x)};
 return {i,channels,threads,member,bot,calls,config:{repostEnabled:true,channelIds:new Set()}};
}
test('private server summary evaluates each effective permission and never mutates',async()=>{
 for(const [name,bit] of REQUIRED_PERMISSIONS){const f=fixture();f.channels.values().next().value.permissionsFor=m=>({has:p=>m===f.bot?p!==bit:true});await createPermissionCheck(f.config)(f.i);assert.equal(f.calls[0].flags,64);assert.ok(f.calls[1].content.includes(name));assert.deepEqual(f.calls[1].allowedMentions,{parse:[],repliedUser:false});}
});
test('large reports paginate within Discord limits and recheck visibility on every request',async()=>{
 const f=fixture(1000);await createPermissionCheck(f.config)(f.i);const first=f.calls.at(-1).content;assert.match(first,/Page 1\/[2-9]\d/);assert.ok(first.length<=2000);
 f.i.options.getInteger=()=>2;await createPermissionCheck(f.config)(f.i);assert.ok(f.calls.at(-1).content.length<=2000);assert.notEqual(first,f.calls.at(-1).content);
 for(const c of f.channels.values())c.permissionsFor=m=>({has:()=>m===f.bot});await createPermissionCheck(f.config)(f.i);assert.doesNotMatch(f.calls.at(-1).content,/<#/);assert.match(f.calls.at(-1).content,/0 eligible/);
});
test('unauthorized users and hidden categories are not disclosed',async()=>{
 const f=fixture();f.member.permissions.has=()=>false;await createPermissionCheck(f.config)(f.i);assert.match(f.calls.at(-1).content,/required/);assert.doesNotMatch(f.calls.at(-1).content,/<#/);
 const g=fixture();const category={id:'100000000000000888',guildId:g.i.guildId,type:4,permissionsFor:()=>({has:()=>false})};g.channels.set(category.id,category);g.channels.values().next().value.parentId=category.id;await createPermissionCheck(g.config)(g.i);assert.ok(!g.calls.at(-1).content.includes(category.id));
});
test('public threads evaluate parent webhook and thread-send permissions; unsupported and failed scans are explicit',async()=>{
 const f=fixture();const parent=f.channels.values().next().value;
 f.threads.set('100000000000000777',{id:'100000000000000777',guildId:f.i.guildId,parentId:parent.id,type:11,archived:false,locked:false,permissionsFor:m=>({has:p=>m===f.bot?p!==P.SendMessagesInThreads:true})});
 await createPermissionCheck(f.config)(f.i);assert.match(f.calls.at(-1).content,/Send Messages in Threads/);assert.match(f.calls.at(-1).content,/Manage Webhooks \(parent\)/);
 f.threads.values().next().value.locked=true;await createPermissionCheck(f.config)(f.i);assert.doesNotMatch(f.calls.at(-1).content,/<#100000000000000777>/);
 f.i.guild.channels.fetchActiveThreads=async()=>{throw Error('SECRET');};await createPermissionCheck(f.config)(f.i);assert.match(f.calls.at(-1).content,/listing failed/);assert.doesNotMatch(f.calls.at(-1).content,/SECRET/);
});
test('conflicting options and unavailable effective permissions fail safely',async()=>{
 const f=fixture();f.i.options.getChannel=()=>({id:'x'});await createPermissionCheck(f.config)(f.i);assert.match(f.calls.at(-1).content,/not both/);
 const g=fixture();g.channels.values().next().value.permissionsFor=m=>m===g.bot?null:{has:()=>true};await createPermissionCheck(g.config)(g.i);assert.match(g.calls.at(-1).content,/1 could not be evaluated/);
});
