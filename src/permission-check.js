import {isThreadChannel,threadShape} from './thread-routing.js';
import {PermissionFlagsBits as P,ChannelType} from 'discord.js';
export const PERMISSION_COMMAND={name:'permissions',description:'Check the bot’s effective permissions in a channel',type:1,defaultMemberPermissions:P.ManageChannels,integrationTypes:[0],contexts:[0],options:[{name:'channel',description:'Channel to check (defaults to this channel)',type:7,required:false}]};
export const REQUIRED_PERMISSIONS=[['View Channel',P.ViewChannel],['Send Messages',P.SendMessages],['Embed Links',P.EmbedLinks],['Read Message History',P.ReadMessageHistory],['Manage Messages',P.ManageMessages],['Manage Webhooks',P.ManageWebhooks]];
const mentions={parse:[],repliedUser:false};
export function createPermissionCheck(config){
 return async interaction=>{
  if(!interaction.isChatInputCommand?.()||interaction.commandName!=='permissions')return false;
  const reply=content=>interaction.reply({content,flags:64,allowedMentions:mentions});
  if(!interaction.guild||!interaction.guildId)return reply('Use this command in a server.');
  await interaction.deferReply({flags:64});
  const finish=content=>interaction.editReply({content,allowedMentions:mentions});
  try{
   const selected=interaction.options.getChannel('channel')??interaction.channel;
   if(!selected?.id||selected.guildId!==interaction.guildId)return finish('That channel is unavailable for this check.');
   const [channel,member,bot]=await Promise.all([interaction.guild.channels.fetch(selected.id,{force:true}),interaction.guild.members.fetch({user:interaction.user.id,force:true}),interaction.guild.members.fetchMe({force:true})]);
   if(!channel||channel.guildId!==interaction.guildId)return finish('That channel is unavailable for this check.');
   const invoker=channel.permissionsFor(member);
   if(!invoker?.has(P.ViewChannel)||!(invoker.has(P.ManageChannels)||member.permissions?.has(P.ManageGuild)))return finish('You need access to the channel and Manage Channels there, or Manage Server, to run this check.');
   const threaded=isThreadChannel(channel);let threadParent;
   if(threaded){
    if(channel.type!==ChannelType.PublicThread)return finish('Private and announcement threads are not supported. No access or thread state was changed.');
    threadParent=await interaction.guild.channels.fetch(channel.parentId,{force:true});
    if(!threadShape({type:channel.type,id:channel.id,guildId:channel.guildId,parentId:channel.parentId,archived:channel.archived,locked:channel.locked,parent:threadParent}))return finish('This thread is not supported: it must be active, unlocked, and under a text, forum, or media channel. No thread was joined, created, unlocked, or unarchived.');
   }else if(![ChannelType.GuildText,ChannelType.GuildVoice].includes(channel.type))return finish('This channel type is not supported. Use a text channel, voice-channel text chat, or active public thread under a text, forum, or media channel.');
   const effective=channel.permissionsFor(bot);
   if(!effective)return finish('The bot’s effective permissions could not be determined. Try again later.');
   const parentEffective=threaded?threadParent.permissionsFor(bot):null;
   if(threaded&&!parentEffective)return finish('The parent channel permissions could not be determined.');
   const requirements=threaded?REQUIRED_PERMISSIONS.filter(([,bit])=>bit!==P.SendMessages&&bit!==P.ManageWebhooks).concat([['Send Messages in Threads',P.SendMessagesInThreads]]):REQUIRED_PERMISSIONS;
   const missing=requirements.filter(([,bit])=>!effective.has(bit)).map(([name])=>name);
   if(threaded){if(!parentEffective.has(P.ViewChannel))missing.push('View Channel (parent)');if(!parentEffective.has(P.ManageWebhooks))missing.push('Manage Webhooks (parent)');}
   const lines=[missing.length?'Missing bot permissions:\n'+missing.map(name=>`• ${name}`).join('\n'):threaded?'Required thread and parent-channel permissions are available.':'All six required bot permissions are available in this channel.'];
   if(missing.length)lines.push('A server administrator can update the bot’s role and the channel or category overrides. A server-level grant may be overridden in a private channel. This command does not change permissions; Administrator is not required.');
   if(config.previewsDisabled)lines.push('Previews are currently disabled by the bot’s configuration.');
   if(config.testGuildId&&config.testGuildId!==interaction.guildId||config.channelIds?.size&&!config.channelIds.has(channel.id))lines.push('This channel is outside the bot’s configured operating scope. Ask the bot operator to review its server/channel restrictions.');
   if(!config.repostEnabled)lines.push('Author-style replacement is disabled by the bot’s configuration.');
   if(bot.isCommunicationDisabled?.())lines.push('The bot is currently timed out in this server.');
   lines.push('This checks permissions, not provider availability. Attachments and thread starters stay untouched. Same-channel replies are supported in eligible channels and threads. Private, archived, locked, and announcement threads stay untouched.');
   return finish(lines.join('\n\n'));
  }catch{return finish('The permission check could not be completed. Check that the bot is installed and try again; no permissions were changed.');}
 };
}
