import { PermissionFlagsBits as P, ChannelType } from 'discord.js';
import { extractLinks, parseSocialUrl } from './previews.js';
import { helperUrl } from './adapters.js';

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
  if (preview.flags === 32768) {
    const name = message.member?.displayName || message.author?.globalName || message.author?.username || 'Member';
    if (/clyde|discord/i.test(name) || /[\u0000-\u001f]/u.test(name) || name.length > 80 || message.content.length > 2000) return null;
    return { ...preview, withComponents: true, username: name,
      avatarURL: message.member?.displayAvatarURL?.() || message.author?.displayAvatarURL?.(),
      components: [...(message.content ? [{ type: 10, content: message.content }] : []), ...preview.components],
      allowedMentions: { parse: [], repliedUser: false } };
  }
  // Preserve source text except approved Instagram links replaced by their media helper.
  const links = extractLinks(message.content);
  const sourceUrls = new Set(links.map(link => link.url));
  const previewLines = (preview.content || '').split('\n');
  const replacements = new Map(links.filter(link => link.platform === 'instagram')
    .map(link => [link.url, helperUrl(link, 'oginstagram')])
    .filter(([, helper]) => previewLines.includes(helper)));
  const usedHelpers = new Set();
  const source = message.content.replace(/```[\s\S]*?(?:```|$)|`[^`]*(?:`|$)|\|\|[\s\S]*?(?:\|\||$)|<[^>]*>|\[[^\]]*\]\([^)]*\)|https:\/\/[^\s<>]+/gi, token => {
    if (!token.startsWith('https://')) return token;
    const raw = token.replace(/[.,!?;:)\]}]+$/, '');
    const helper = replacements.get(parseSocialUrl(raw)?.url);
    if (!helper) return token;
    usedHelpers.add(helper);
    return helper + token.slice(raw.length);
  });
  const extraLines = previewLines.filter(line => {
    if (usedHelpers.has(line)) return false;
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
