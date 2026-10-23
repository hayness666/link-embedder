import {ChannelType, PermissionFlagsBits as P} from 'discord.js';
import {threadShape} from './thread-routing.js';

// Fresh metadata only: no message reads, membership changes, or retained reports.
export async function serverPermissionReport(interaction, config, requirements) {
 const guild=interaction.guild;
 const [member,bot]=await Promise.all([guild.members.fetch({user:interaction.user.id,force:true}),guild.members.fetchMe({force:true})]);
 if(!member.permissions?.has(P.ManageGuild)&&!member.permissions?.has(P.ManageChannels))return 'Manage Server or Manage Channels is required for a server report.';
 await guild.roles?.fetch();
 const channels=await guild.channels.fetch();
 let threads,threadScan=true;
 try{threads=(await guild.channels.fetchActiveThreads()).threads;}catch{threadScan=false;threads=new Map();}
 const visible=c=>c?.guildId===interaction.guildId&&c.permissionsFor(member)?.has(P.ViewChannel);
 const allowed=c=>visible(c)&&(member.permissions.has(P.ManageGuild)||c.permissionsFor(member)?.has(P.ManageChannels));
 const groups=new Map();let checked=0,healthy=0,unknown=0,unsupported=0;
 const all=new Map([...channels,...threads]);
 for(const c of all.values()){
  if(!allowed(c))continue;
  const threaded=c.type===ChannelType.PublicThread;
  const parent=threaded?channels.get(c.parentId):null;
  if(threaded&&!allowed(parent))continue;
  if(threaded?!threadShape({type:c.type,id:c.id,guildId:c.guildId,parentId:c.parentId,archived:c.archived,locked:c.locked,parent}):![ChannelType.GuildText,ChannelType.GuildVoice].includes(c.type)){unsupported++;continue;}
  const effective=c.permissionsFor(bot),pe=threaded?parent.permissionsFor(bot):null;
  if(!effective||(threaded&&!pe)){unknown++;continue;}
  checked++;
  const needed=threaded?requirements.filter(([,b])=>b!==P.SendMessages&&b!==P.ManageWebhooks).concat([['Send Messages in Threads',P.SendMessagesInThreads]]):requirements;
  const missing=needed.filter(([,b])=>!effective.has(b)).map(([n])=>n);
  if(threaded){if(!pe.has(P.ViewChannel))missing.push('View Channel (parent)');if(!pe.has(P.ManageWebhooks))missing.push('Manage Webhooks (parent)');}
  if(config.testGuildId&&config.testGuildId!==interaction.guildId||config.channelIds?.size&&!config.channelIds.has(c.id))missing.push('Outside configured operating scope');
  if(!missing.length){healthy++;continue;}
  const category=channels.get(threaded?parent.parentId:c.parentId);
  const categoryLabel=category&&visible(category)?`Category <#${category.id}>`:'Other channels';
  const key=`${categoryLabel} — ${missing.join(', ')}`;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(`<#${c.id}>`);
 }
 const lines=[];
 for(const [key,ids] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
  ids.sort();
  for(let i=0;i<ids.length;i+=12)lines.push(`${key}\n${ids.slice(i,i+12).join(', ')}`);
 }
 const pages=[''];
 for(const line of lines){if(pages.at(-1).length+line.length>1050)pages.push('');pages[pages.length-1]+=(pages.at(-1)?'\n\n':'')+line;}
 const requested=interaction.options.getInteger?.('page')??1;
 const page=Math.max(1,Math.min(requested,pages.length));
 const status=[config.previewsDisabled?'Previews are disabled.':'',!config.repostEnabled?'Author-style replacement is disabled.':'',bot.isCommunicationDisabled?.()?'The bot is timed out.':''].filter(Boolean).join(' ');
 return [`Server permissions · Page ${page}/${pages.length}`,`${checked} eligible channels checked; ${healthy} have required permissions. ${unknown} could not be evaluated; ${unsupported} visible/manageable channels are unsupported.`,pages[page-1]||'No permission problems found in the checked channels.',status,'Coverage: only channels you can view and manage, plus accessible active public threads. Private, archived, locked, and announcement threads are not checked. Hidden or unavailable channels are not covered.'+(threadScan?'':' Active-thread listing failed; threads were not scanned.'),'Change pages with /permissions scope:server page:number. Each request checks fresh access. Adjust the bot role or channel/category overrides where needed; this command changes nothing. Permissions do not guarantee provider availability.'].filter(Boolean).join('\n\n');
}
