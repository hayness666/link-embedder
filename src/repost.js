import {isThreadChannel,threadShape,threadPermissions,refreshWebhookRoute,verifyThreadHook,threadOptions} from './thread-routing.js';
import {replyReferenceId,resolveReplyContext,checkReplyBudget,replyNoteComponents,USER_TEXT_COMPONENT_ID} from './reply-context.js';
import {withCardControls} from './card-controls.js';
import { PermissionFlagsBits as P, ChannelType } from 'discord.js';
import { extractLinks, parseSocialUrl } from './previews.js';

// Replace only eligible text messages in supported channels and active public threads.
export function canRepost(message, user) {
  const threaded=isThreadChannel(message.channel);
  return (threaded ? threadShape(message.channel)&&message.channelId===message.channel.id&&message.guildId===message.channel.guildId&&message.id!==message.channel.id : [ChannelType.GuildText, ChannelType.GuildVoice].includes(message.channel?.type))
    && ((message.type === 0 && !message.reference)
      || Boolean(replyReferenceId(message)))
    && message.deletable === true && !message.poll && !message.pinned
    && !message.hasThread && !message.attachments?.size && !message.stickers?.size
    && !message.components?.length && !message.reactions?.cache?.size
    && !message.flags?.has(4)
    && (threaded ? threadPermissions(message.channel,user) : Boolean(message.channel.permissionsFor(user)?.has([
      P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageMessages, P.ManageWebhooks
    ])));
}

export function buildRepostPayload(message, preview, displayContent = message.content) {
  const originalDisplay = displayContent;
  displayContent = cleanCardLinks(displayContent);
  if (preview.flags === 32768 && preview.components?.[0]?.type === 10 && preview.components[0].content === originalDisplay) {
    preview = {...preview,components:[{...preview.components[0],content:displayContent},...preview.components.slice(1)]};
  }
  if (preview.flags === 32768) {
    const name = message.member?.displayName || message.author?.globalName || message.author?.username || 'Member';
    if (/clyde|discord/i.test(name) || /[\u0000-\u001f]/u.test(name) || name.length > 80 || displayContent.length > 2000) return null;
    return { ...preview, withComponents: true, username: name,
      avatarURL: message.member?.displayAvatarURL?.() || message.author?.displayAvatarURL?.(),
      components: [...(displayContent && preview.components[0]?.content !== displayContent ? [{ type: 10, content: displayContent }] : []), ...preview.components],
      allowedMentions: { parse: [], repliedUser: false } };
  }
  // Preserve the sender's text exactly; helper/native URLs are separate preview data.
  const links = extractLinks(displayContent);
  const sourceUrls = new Set(links.map(link => link.url));
  const previewLines = (preview.content || '').split('\n');
  const source = displayContent;
  const extraLines = previewLines.filter(line => {
    const original = /^Original: <(https:\/\/[^>]+)>$/.exec(line)?.[1];
    const canonical = parseSocialUrl(original || line)?.url;
    return line && !(canonical && sourceUrls.has(canonical));
  });
  const content = [source, extraLines.join('\n')].filter(Boolean).join('\n\n');
  if (content.length > 2000) return null;
  const name = message.member?.displayName || message.author?.globalName || message.author?.username || 'Member';
  if (/clyde|discord/i.test(name) || /[\u0000-\u001f]/u.test(name) || name.length > 80) return null;
  return { ...preview, content, username: name,
    avatarURL: message.member?.displayAvatarURL?.() || message.author?.displayAvatarURL?.(),
    allowedMentions: { parse: [], repliedUser: false } };
}

export function createReposter(user, log = () => {}, owners = null) {
  return async (message, preview, displayContent = message.content) => {
    if (!canRepost(message, user)) return false;
    const payload = buildRepostPayload(message, preview, displayContent);
    if (!payload) return false;
    const isReply = message.type === 19;
    // Reply notes require tracked custom cards; never degrade to an unlinked helper post.
    if ((isReply || isThreadChannel(message.channel)) && (payload.flags !== 32768 || !owners)) return false;
    let replyContext;
    let replacement;
    let hook;
    let route;
    try {
      if(payload.flags===32768 && owners){
        if(payload.components?.[0]?.type!==10)throw Error('Sender text missing');
        payload.components[0]={...payload.components[0],id:USER_TEXT_COMPONENT_ID};
      }
      if (isReply) {
        replyContext = await resolveReplyContext(message,owners);
        payload.components.unshift(...replyNoteComponents(replyContext.note));
        payload.allowedMentions = {parse:[],users:replyContext.authorId?[replyContext.authorId]:[],repliedUser:false};
      }
      route=await refreshWebhookRoute(message.channel,user);
      const hooks = await route.channel.fetchWebhooks();
      hook = hooks.find(h => h.owner?.id === user.id && h.name === 'Link Embedder Reposts' && h.token && (!route.threadId||h.channelId===route.channel.id));
      hook ??= await route.channel.createWebhook({ name: 'Link Embedder Reposts', reason: 'Owner-approved link repost channel' });
      if (payload.flags === 32768 && owners) {
        if (hook.applicationId !== user.id) throw Error('Application webhook required');
        payload.components = withCardControls(payload.components);
        if (isReply) checkReplyBudget(payload.components);
      }
      verifyThreadHook(hook,route);
      if(route.threadId){
        const latest=await refreshWebhookRoute(message.channel,user);
        if(latest.threadId!==route.threadId||latest.channel.id!==route.channel.id)throw Error('Thread changed');
      }
      // discord.js Webhook.send requests wait=true; require a confirmed message before deletion.
      replacement = await hook.send({...payload,...threadOptions(route)});
      if (!replacement?.id) throw new Error('No confirmed replacement');
      if(route.threadId&&(replacement.channelId!==route.threadId||replacement.guildId!==message.guildId))throw Error('Wrong replacement destination');
      if (owners) await owners.put(replacement.id, {ownerId:message.author.id,guildId:message.guildId,channelId:message.channelId,webhookId:hook.id,...(payload.flags===32768?{sourceComponentId:USER_TEXT_COMPONENT_ID}:{}),...(route.threadId?{webhookChannelId:route.channel.id}:{}),...(replyContext ? {replyMessageId:replyContext.messageId} : {})});
      let fresh = await message.channel.messages.fetch({ message: message.id, force: true, cache: false });
      if (!canRepost(fresh, user) || fresh.content !== message.content
        || fresh.editedTimestamp !== message.editedTimestamp
        || (isReply && replyReferenceId(fresh)!==replyContext.messageId)) throw new Error('Source changed');
      if (isReply) {
        const again=await resolveReplyContext(fresh,owners);
        if(again.messageId!==replyContext.messageId || again.authorId!==replyContext.authorId)throw Error('Reply target changed');
        fresh=await message.channel.messages.fetch({message:message.id,force:true,cache:false});
        if(!canRepost(fresh,user)||fresh.content!==message.content||fresh.editedTimestamp!==message.editedTimestamp||replyReferenceId(fresh)!==replyContext.messageId)throw Error('Source changed');
      }
      if(route.threadId){
        await refreshWebhookRoute(message.channel,user);
        if(fresh.channelId!==route.threadId||fresh.guildId!==message.guildId||fresh.id!==message.id||fresh.id===route.threadId)throw Error('Wrong source destination');
      }
      await fresh.delete();
      return true;
    } catch {
      log('repost_failed_original_preserved_or_delete_unconfirmed');
      // A delete can succeed even when its response is lost. Never remove the only confirmed copy.
      if (replacement?.id) {
        try {
          const original=await message.channel.messages.fetch({ message: message.id, force: true, cache: false });
          if(route?.threadId&&(original?.id!==message.id||original.channelId!==route.threadId||original.guildId!==message.guildId))throw Error('Original unavailable');
          await hook.deleteMessage(replacement.id,route?.threadId);
          if (owners) await owners.remove(replacement.id);
        } catch { log('repost_cleanup_unconfirmed'); }
      }
      return true; // Do not send another copy after an ambiguous network result.
    }
  };
}

import {shortFamily} from './short-links.js';
import {stripTrackingParameters} from './urls.js';
const tokens=/```[\s\S]*?(?:```|$)|`[^`]*(?:`|$)|\|\|[\s\S]*?(?:\|\||$)|<[^>]*>|\[[^\]]*\]\([^)]*\)|https:\/\/[^\s<>]+/gi;
export function cleanCardLinks(content) {
 return content.replace(tokens,token=>{
  if(!token.startsWith('https://'))return token;
  const raw=token.replace(/[.,!?;:)\]}]+$/,'');
  const link=parseSocialUrl(raw);
  if(!link&&!shortFamily(raw))return token;
  const u=stripTrackingParameters(new URL(raw));
  // The parser supplies the functional query for recognized content routes.
  // Preserve source host/path presentation, but use that allowlist for parameters.
  if (link) {
    u.search = new URL(link.url).search;
    u.hash = '';
  }
  const cleaned=link?.platform==='amazon'?link.url:u.href;
  return cleaned+token.slice(raw.length);
 });
}
