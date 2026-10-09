import { PermissionFlagsBits as P, ChannelType } from 'discord.js';
import { extractLinks, parseSocialUrl } from './previews.js';

// Destructive replacement is deliberately restricted to plain text in opted-in text channels.
export function canRepost(message, user) {
  return message.channel?.type === ChannelType.GuildText && message.type === 0
    && message.deletable === true && !message.reference && !message.poll && !message.pinned
    && !message.hasThread && !message.attachments?.size && !message.stickers?.size
    && !message.components?.length && !message.reactions?.cache?.size
    && !message.flags?.has(4)
    && Boolean(message.channel.permissionsFor(user)?.has([
      P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageMessages, P.ManageWebhooks
    ]));
}

export function buildRepostPayload(message, preview) {
  // Preserve every character of the source text; never truncate to make a replacement fit.
  const sourceUrls = new Set(extractLinks(message.content).map(link => link.url));
  const extraLines = (preview.content || '').split('\n').filter(line => {
    const canonical = parseSocialUrl(line)?.url;
    return line && !(canonical && sourceUrls.has(canonical));
  });
  const content = [message.content, extraLines.join('\n')].filter(Boolean).join('\n\n');
  if (content.length > 2000) return null;
  const name = message.member?.displayName || message.author?.globalName || message.author?.username || 'Member';
  if (/clyde|discord/i.test(name) || /[\u0000-\u001f]/u.test(name) || name.length > 80) return null;
  return { ...preview, content, username: name,
    avatarURL: message.member?.displayAvatarURL?.() || message.author?.displayAvatarURL?.(),
    allowedMentions: { parse: [], repliedUser: false } };
}

export function createReposter(user, log = () => {}) {
  return async (message, preview) => {
    if (!canRepost(message, user)) return false;
    const payload = buildRepostPayload(message, preview);
    if (!payload) return false;
    let replacement;
    let hook;
    try {
      const hooks = await message.channel.fetchWebhooks();
      hook = hooks.find(h => h.owner?.id === user.id && h.name === 'Link Embedder Reposts' && h.token);
      hook ??= await message.channel.createWebhook({ name: 'Link Embedder Reposts', reason: 'Owner-approved link repost channel' });
      // discord.js Webhook.send requests wait=true; require a confirmed message before deletion.
      replacement = await hook.send(payload);
      if (!replacement?.id) throw new Error('No confirmed replacement');
      const fresh = await message.channel.messages.fetch({ message: message.id, force: true, cache: false });
      if (!canRepost(fresh, user) || fresh.content !== message.content
        || fresh.editedTimestamp !== message.editedTimestamp) throw new Error('Source changed');
      await fresh.delete();
      return true;
    } catch {
      log('repost_failed_original_preserved_or_delete_unconfirmed');
      // A delete can succeed even when its response is lost. Never remove the only confirmed copy.
      if (replacement?.id) {
        try {
          await message.channel.messages.fetch({ message: message.id, force: true, cache: false });
          await hook.deleteMessage(replacement.id);
        } catch { log('repost_cleanup_unconfirmed'); }
      }
      return true; // Do not send another copy after an ambiguous network result.
    }
  };
}
