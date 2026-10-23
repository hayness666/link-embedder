import {refreshWebhookRoute,verifyThreadHook,threadOptions} from './thread-routing.js';
import {isCardMenuId} from './card-controls.js';
import {createEditHandler} from './edit-post.js';
export const COMMAND = 'Manage Post';
export const REOPEN = 'To open this menu again, go to the post, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage Post**.';
const deny = 'This menu works on Link Embedder replacement posts with a saved ownership record. Original messages, separate preview replies, and older unrecorded reposts cannot be managed here.';
const privateReply = content => ({content,flags:64,allowedMentions:{parse:[]}});

export function hasSpoilerMedia(components) {
  return components.some(node=>{const c=node.toJSON?.()??node;return (c.type===12&&c.items?.some(item=>item.spoiler===true))||(c.components&&hasSpoilerMedia(c.components));});
}
export function spoilerComponents(components, spoiler = true) {
  let mediaCount = 0;
  function visit(c) {
    const out = structuredClone(c.toJSON?.() ?? c);
    // Strip read-only fields from unfurled media before resubmitting.
    if (out.type === 12) out.items = out.items.map(item => {
      mediaCount++;
      return {media:{url:item.media.url},...(item.description ? {description:item.description} : {}),spoiler};
    });
    if (out.components) out.components = out.components.map(visit);
    return out;
  }
  const result = components.map(visit);
  return mediaCount ? result : null;
}
export function managementMenu(id, isOwner = true, marked = false) {
  return {flags:64,allowedMentions:{parse:[]},components:[{type:1,components:[
    ...(isOwner ? [{type:2,style:3,label:'Edit Post',custom_id:`manage:edit:${id}`},{type:2,style:4,label:'Delete Post',custom_id:`manage:delete:${id}`}] : []),
    isOwner&&marked ? {type:2,style:2,label:'Remove spoiler',custom_id:`manage:unspoiler:${id}`} : {type:2,style:1,label:'Mark NSFW',custom_id:`manage:nsfw:${id}`}
  ]}]};
}
export function createManagementHandler(store, config, log = () => {}) {
  const busy = new Set();
  const edit = createEditHandler(store,config,busy,log);
  return async interaction => {
    if (await edit(interaction)) return;
    const openCard = interaction.isButton?.() && isCardMenuId(interaction.customId);
    const command = interaction.isMessageContextMenuCommand?.() && interaction.commandName === COMMAND;
    const button = interaction.isButton?.() && /^manage:(delete|nsfw|unspoiler|dismiss):\d{17,20}$/.test(interaction.customId);
    if (!command && !button && !openCard) return;
    const [,action,id] = openCard ? [null,'menu',interaction.message?.id] : command ? [null,'menu',interaction.targetId] : interaction.customId.split(':');
    const row = store.get(id);
    if (!row || row.guildId !== interaction.guildId || row.channelId !== interaction.channelId
      || (config.testGuildId && row.guildId !== config.testGuildId) || (config.channelIds.size && !config.channelIds.has(row.channelId))) {
      await interaction.reply(privateReply(deny)); return;
    }
    const isOwner = row.ownerId === interaction.user.id;
    if(action==='unspoiler'&&!isOwner){await interaction.reply(privateReply('Only the original poster can remove spoilers.'));return;}
    if (action === 'delete' && !isOwner) {
      await interaction.reply(privateReply('Only the original poster can delete this repost. Anyone can mark its media NSFW.')); return;
    }
    if (action === 'dismiss') { await interaction.update({content:'Menu dismissed. '+REOPEN,components:[]}); return; }
    if (action === 'menu') {
      await interaction.deferReply({flags:64});
      const finish=payload=>{const {flags,...body}=payload;return interaction.editReply(body);};
      if(openCard){
        try {
          if(interaction.message.webhookId!==row.webhookId)throw Error('Webhook mismatch');
          const route=await refreshWebhookRoute(interaction.channel,interaction.client.user,row);
          const hooks=await route.channel.fetchWebhooks();
          const hook=hooks.find(h=>h.id===row.webhookId&&h.owner?.id===interaction.client.user.id&&h.applicationId===interaction.client.user.id);
          if(!hook)throw Error('Application mismatch');verifyThreadHook(hook,route);
          const fresh=store.get(id);if(!fresh||fresh.ownerId!==row.ownerId||fresh.webhookId!==row.webhookId||fresh.guildId!==row.guildId||fresh.channelId!==row.channelId||fresh.webhookChannelId!==row.webhookChannelId)throw Error('Ownership changed');
        }catch{await finish(privateReply(deny));return;}
      }
      try{
        const current=await interaction.channel.messages.fetch({message:id,force:true,cache:false});
        if(current.webhookId!==row.webhookId)throw Error('Webhook mismatch');
        const fresh=store.get(id);
        if(!fresh||fresh.ownerId!==row.ownerId||fresh.webhookId!==row.webhookId||fresh.channelId!==row.channelId||fresh.guildId!==row.guildId)throw Error('Ownership changed');
        await finish(managementMenu(id,isOwner,hasSpoilerMedia(current.components||[])));
      }catch{await finish(privateReply(deny));}
      return;
    }
    if (busy.has(id)) { await interaction.reply(privateReply('An action on this post is already in progress.')); return; }
    busy.add(id);
    try {
      await interaction.deferUpdate();
      const current = await interaction.channel.messages.fetch({message:id,force:true,cache:false});
      if (current.webhookId !== row.webhookId) throw new Error('Wrong webhook');
      const route=await refreshWebhookRoute(interaction.channel,interaction.client.user,row);
      const hooks = await route.channel.fetchWebhooks();
      const hook = hooks.find(h => h.id === row.webhookId && h.owner?.id === interaction.client.user.id && h.token);
      if (!hook) throw new Error('Webhook unavailable');
      verifyThreadHook(hook,route);
      if(route.threadId&&(current.channelId!==row.channelId||current.guildId!==row.guildId||current.id!==id||current.id===row.channelId))throw Error('Wrong thread message');
      const latest=store.get(id);if(!latest||latest.ownerId!==row.ownerId||latest.channelId!==row.channelId||latest.webhookChannelId!==row.webhookChannelId||latest.webhookId!==row.webhookId)throw Error('Ownership changed');
      await refreshWebhookRoute(interaction.channel,interaction.client.user,row);
      if (action === 'delete') {
        await hook.deleteMessage(id,route.threadId);
        await store.remove(id);
        await interaction.editReply({content:'Your repost was deleted.',components:[]});
      } else {
        if(action==='unspoiler'&&!hasSpoilerMedia(current.components||[])){
          await interaction.editReply({content:'This post no longer has gallery spoilers. No changes were made.',components:[]});return;
        }
        const components = spoilerComponents(current.components || [],action!=='unspoiler');
        if (!components) {
          await interaction.editReply({content:'This post does not contain a custom photo/video card that can be marked as a spoiler. No changes were made.\n\n'+REOPEN,components:[]});
          return;
        }
        await hook.editMessage(id,{...threadOptions(route),components,withComponents:true,allowedMentions:{parse:[],repliedUser:false}});
        await interaction.editReply({content:action==='unspoiler'?'Gallery spoilers were removed. The post, reply links, and controls are unchanged.':'Photos/videos are now covered as spoilers. The caption and link remain visible. This does not age-restrict the post or channel.',components:[]});
      }
    } catch {
      log('manage_post_failed');
      try { await interaction.editReply({content:'I could not confirm the action. Check the post, then reopen this menu to try again.',components:[]}); } catch { /* no sensitive error logging */ }
    } finally { busy.delete(id); }
  };
}
