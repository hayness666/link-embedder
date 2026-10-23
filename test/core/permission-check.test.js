import test from 'node:test';
import assert from 'node:assert/strict';
import {PermissionFlagsBits as P} from 'discord.js';
import {createPermissionCheck,REQUIRED_PERMISSIONS,PERMISSION_COMMAND} from '../../src/permission-check.js';
function fixture(){
 const calls=[],member={permissions:{has:()=>false}},bot={},allowed=new Set(REQUIRED_PERMISSIONS.map(x=>x[1]));
 const channel={id:'channel',guildId:'guild',type:0,permissionsFor:m=>m===bot?{has:p=>allowed.has(p)}:{has:p=>p===P.ViewChannel||p===P.ManageChannels}};
 const i={isChatInputCommand:()=>true,commandName:'permissions',guildId:'guild',user:{id:'user'},channel,options:{getChannel:()=>null},guild:{channels:{fetch:async()=>channel},members:{fetch:async()=>member,fetchMe:async()=>bot}},deferReply:async p=>calls.push(p),editReply:async p=>calls.push(p),reply:async p=>calls.push(p)};
 return {i,calls,channel,member,bot,allowed,config:{repostEnabled:true,channelIds:new Set()}};
}
test('reports every missing effective permission privately without mutation',async()=>{
 for(const [name,bit] of REQUIRED_PERMISSIONS){const f=fixture();f.allowed.delete(bit);await createPermissionCheck(f.config)(f.i);assert.equal(f.calls[0].flags,64);assert.match(f.calls[1].content,new RegExp(name));assert.deepEqual(f.calls[1].allowedMentions,{parse:[],repliedUser:false});assert.doesNotMatch(f.calls[1].content,/All six/);}
});
test('voice and text channels report success; scope and disabled flags stay accurate',async()=>{
 for(const type of [0,2]){const f=fixture();f.channel.type=type;await createPermissionCheck(f.config)(f.i);assert.match(f.calls[1].content,/All six/);}
 const f=fixture();await createPermissionCheck({...f.config,previewsDisabled:true,testGuildId:'other',repostEnabled:false})(f.i);assert.match(f.calls[1].content,/outside/);assert.match(f.calls[1].content,/disabled/);
});
test('unauthorized and inaccessible targets disclose no permission details',async()=>{
 for(const visible of [false,true]){const f=fixture();f.channel.permissionsFor=()=>({has:p=>visible&&p===P.ViewChannel});await createPermissionCheck(f.config)(f.i);assert.match(f.calls[1].content,/You need access/);assert.doesNotMatch(f.calls[1].content,/Missing bot|All six/);}
 const f=fixture();f.channel.guildId='other';await createPermissionCheck(f.config)(f.i);assert.match(f.calls[1].content,/unavailable/);
});
test('unsupported types, missing permissions result, and fetch errors fail safely',async()=>{
 for(const type of [11,12,13,15]){const f=fixture();f.channel.type=type;await createPermissionCheck(f.config)(f.i);assert.match(f.calls[1].content,/not supported/);}
 const f=fixture();f.i.guild.channels.fetch=async()=>{throw Error('SECRET');};await createPermissionCheck(f.config)(f.i);assert.doesNotMatch(JSON.stringify(f.calls),/SECRET/);assert.match(f.calls[1].content,/could not be completed/);
});
test('other interactions remain untouched and command uses no Administrator default',async()=>{
 const f=fixture();f.i.commandName='other';assert.equal(await createPermissionCheck(f.config)(f.i),false);assert.deepEqual(f.calls,[]);assert.equal(PERMISSION_COMMAND.defaultMemberPermissions,P.ManageChannels);assert.equal(PERMISSION_COMMAND.options[0].required,false);
});
