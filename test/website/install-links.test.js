import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PermissionFlagsBits as P} from 'discord.js';
const limited=P.ViewChannel|P.SendMessages|P.EmbedLinks|P.ReadMessageHistory|P.ManageMessages|P.ManageWebhooks|P.SendMessagesInThreads;
test('both install options keep the same application and scopes with exactly disclosed permissions',async()=>{
 for(const file of ['../../src/website/index.html','../../README.md']){
  const text=await readFile(new URL(file,import.meta.url),'utf8');
  const urls=[...text.matchAll(/https:\/\/discord\.com\/oauth2\/authorize\?[^"\s)]+/g)].map(m=>new URL(m[0].replaceAll('&amp;','&')));
  assert.equal(urls.length,2);assert.deepEqual(urls.map(u=>u.searchParams.get('permissions')),['8','275414871040']);
  for(const u of urls){assert.equal(u.origin,'https://discord.com');assert.equal(u.pathname,'/oauth2/authorize');assert.deepEqual([...u.searchParams.keys()].sort(),['client_id','integration_type','permissions','scope']);assert.equal(u.searchParams.get('client_id'),'1557858203897823304');assert.equal(u.searchParams.get('scope'),'bot');assert.equal(u.searchParams.get('integration_type'),'0');}
  assert.equal(BigInt(urls[0].searchParams.get('permissions')),P.Administrator);assert.equal(BigInt(urls[1].searchParams.get('permissions')),limited);assert.equal(limited&P.Administrator,0n);
  assert.match(text,/Grants full server permissions/);assert.match(text,/Limited-permissions install/);
 }
});
test('easy install has a visible associated disclosure and limited setup has an anchor',async()=>{
 const index=await readFile(new URL('../../src/website/index.html',import.meta.url),'utf8');
 assert.match(index,/aria-describedby="easy-install-disclosure"/);assert.match(index,/<p id="easy-install-disclosure"><strong>Grants full server permissions<\/strong><\/p>/);
 const help=await readFile(new URL('../../src/website/pages/help.html',import.meta.url),'utf8');assert.match(help,/private-channel step applies to Limited-permissions install/);assert.match(help,/id="private-channel-setup"/);
});
