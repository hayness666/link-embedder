import {ChannelType as C,PermissionFlagsBits as P} from 'discord.js';
const snowflake=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
export const isThreadChannel=channel=>[C.AnnouncementThread,C.PublicThread,C.PrivateThread].includes(channel?.type);
export function threadShape(channel) {
  const parent=channel?.parent;
  return channel?.type===C.PublicThread && channel.archived===false && channel.locked===false
    && snowflake(channel.id)&&snowflake(channel.guildId)&&snowflake(channel.parentId)
    && parent?.id===channel.parentId&&parent.guildId===channel.guildId
    && [C.GuildText,C.GuildForum,C.GuildMedia].includes(parent.type);
}
export function threadPermissions(channel,user) {
  return Boolean(channel.permissionsFor(user)?.has([P.ViewChannel,P.SendMessagesInThreads,P.EmbedLinks,P.ReadMessageHistory,P.ManageMessages])
    && channel.parent?.permissionsFor(user)?.has([P.ViewChannel,P.ManageWebhooks]));
}
export function webhookRoute(channel,user,row) {
  if(isThreadChannel(channel)) {
    if(!threadShape(channel)||!threadPermissions(channel,user)
      || row && (row.channelId!==channel.id||row.guildId!==channel.guildId||row.webhookChannelId!==channel.parentId))throw Error('Thread unavailable');
    return {channel:channel.parent,threadId:channel.id};
  }
  if(row?.webhookChannelId)throw Error('Thread route missing');
  return {channel,threadId:undefined};
}
export async function refreshWebhookRoute(channel,user,row) {
  if(!isThreadChannel(channel))return webhookRoute(channel,user,row);
  const expected={id:channel.id,guildId:channel.guildId,parentId:channel.parentId};
  const fresh=await channel.guild.channels.fetch(expected.id,{force:true});
  if(!fresh||fresh.id!==expected.id||fresh.guildId!==expected.guildId||fresh.parentId!==expected.parentId)throw Error('Thread changed');
  const parent=await channel.guild.channels.fetch(expected.parentId,{force:true});
  // Validate fresh parent identity without relying on an older cached parent object.
  const view={type:fresh.type,id:fresh.id,guildId:fresh.guildId,parentId:fresh.parentId,archived:fresh.archived,locked:fresh.locked,parent,permissionsFor:u=>fresh.permissionsFor(u)};
  return webhookRoute(view,user,row);
}
export function verifyThreadHook(hook,route) {
  if(route.threadId&&hook.channelId!==route.channel.id)throw Error('Wrong webhook parent');
}
export const threadOptions=route=>route.threadId?{threadId:route.threadId}:{};
// A user's message may reopen an unlocked thread before the cached archive update arrives.
// Read state only; never join, unlock, or unarchive a thread ourselves.
export async function refreshReopenedThreadMessage(message) {
  const channel=message.channel;
  if(channel?.type!==C.PublicThread||channel.archived!==true||channel.locked!==false)return message;
  const expected={id:channel.id,guildId:channel.guildId,parentId:channel.parentId};
  const fresh=await channel.guild.channels.fetch(expected.id,{force:true});
  if(!fresh||fresh.id!==expected.id||fresh.guildId!==expected.guildId||fresh.parentId!==expected.parentId
    ||fresh.archived!==false||fresh.locked!==false||fresh.type!==C.PublicThread) return null;
  await channel.guild.channels.fetch(expected.parentId,{force:true});
  if(!threadShape(fresh))return null;
  // Keep Discord Message methods/getters bound to their original object, while eligibility
  // uses the freshly fetched channel even when the SDK returns a distinct object.
  return new Proxy(message,{get(target,key){if(key==='channel')return fresh;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
}
