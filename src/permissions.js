import { PermissionFlagsBits as P } from 'discord.js';
export function canSendPreview(message, user) {
  const channel = message.channel;
  if (!channel?.isTextBased?.() || !channel.isSendable?.()) return false;
  const thread = channel.isThread?.();
  if (thread && (channel.archived || channel.locked)) return false;
  if (thread && channel.type === 12 && !channel.joined) return false;
  const required = [P.ViewChannel, P.EmbedLinks, thread ? P.SendMessagesInThreads : P.SendMessages];
  // Effective permissions are evaluated afresh against current channel/role cache each event.
  return Boolean(channel.permissionsFor(user)?.has(required));
}
