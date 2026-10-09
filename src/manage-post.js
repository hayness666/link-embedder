export const COMMAND = 'Manage my post';
export const REOPEN = 'To open this menu again, go to the post, open its options, choose **Apps**, choose **Link Embedder** if shown, then **Manage my post**.';
const deny = 'Only the original poster can manage this repost. Older reposts without a saved ownership record cannot be managed.';
const privateReply = content => ({content,flags:64,allowedMentions:{parse:[]}});

export function spoilerComponents(components) {
  let mediaCount = 0;
  function visit(c) {
    const out = structuredClone(c.toJSON?.() ?? c);
    // Strip read-only fields from unfurled media before resubmitting.
    if (out.type === 12) out.items = out.items.map(item => {
      mediaCount++;
      return {media:{url:item.media.url},...(item.description ? {description:item.description} : {}),spoiler:true};
    });
    if (out.components) out.components = out.components.map(visit);
    return out;
  }
  const result = components.map(visit);
  return mediaCount ? result : null;
}
export function managementMenu(id) {
  return {...privateReply('**Manage your post**\n\n**Delete post** removes the whole repost; your original message will not be restored.\n**Mark NSFW** covers photos/videos with a spoiler. It does not age-restrict the post or channel.\n**Dismiss** closes this menu.\n\n'+REOPEN),components:[{type:1,components:[
    {type:2,style:4,label:'Delete post',custom_id:`manage:delete:${id}`},
    {type:2,style:2,label:'Mark NSFW',custom_id:`manage:nsfw:${id}`},
    {type:2,style:2,label:'Dismiss',custom_id:`manage:dismiss:${id}`}
  ]}]};
}
export function createManagementHandler(store, config, log = () => {}) {
  const busy = new Set();
  return async interaction => {
    const command = interaction.isMessageContextMenuCommand?.() && interaction.commandName === COMMAND;
    const button = interaction.isButton?.() && /^manage:(delete|nsfw|dismiss):\d{17,20}$/.test(interaction.customId);
    if (!command && !button) return;
    const [,action,id] = command ? [null,'menu',interaction.targetId] : interaction.customId.split(':');
    const row = store.get(id);
    if (!row || row.ownerId !== interaction.user.id || row.guildId !== interaction.guildId || row.channelId !== interaction.channelId
      || row.guildId !== config.testGuildId || !config.channelIds.has(row.channelId)) {
      await interaction.reply(privateReply(deny)); return;
    }
    if (action === 'dismiss') { await interaction.update({content:'Menu dismissed. '+REOPEN,components:[]}); return; }
    if (action === 'menu') { await interaction.reply(managementMenu(id)); return; }
    if (busy.has(id)) { await interaction.reply(privateReply('An action on this post is already in progress.')); return; }
    busy.add(id);
    try {
      await interaction.deferUpdate();
      const current = await interaction.channel.messages.fetch({message:id,force:true,cache:false});
      if (current.webhookId !== row.webhookId) throw new Error('Wrong webhook');
      const hooks = await interaction.channel.fetchWebhooks();
      const hook = hooks.find(h => h.id === row.webhookId && h.owner?.id === interaction.client.user.id && h.token);
      if (!hook) throw new Error('Webhook unavailable');
      if (action === 'delete') {
        await hook.deleteMessage(id);
        await store.remove(id);
        await interaction.editReply({content:'Your repost was deleted.',components:[]});
      } else {
        const components = spoilerComponents(current.components || []);
        if (!components) {
          await interaction.editReply({content:'This post does not contain a custom photo/video card that can be marked as a spoiler. No changes were made.\n\n'+REOPEN,components:[]});
          return;
        }
        await hook.editMessage(id,{components,withComponents:true,allowedMentions:{parse:[],repliedUser:false}});
        await interaction.editReply({content:'Photos/videos are now covered as spoilers. The caption and link remain visible. This does not age-restrict the post or channel.\n\n'+REOPEN,components:[]});
      }
    } catch {
      log('manage_post_failed');
      try { await interaction.editReply({content:'I could not confirm the action. Check the post, then reopen this menu to try again.',components:[]}); } catch { /* no sensitive error logging */ }
    } finally { busy.delete(id); }
  };
}
