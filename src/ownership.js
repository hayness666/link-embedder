import { mkdir, readFile, open, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

// IDs only: no original message text, credentials, or webhook tokens.
export async function openOwnershipStore(path = 'data/repost-owners.json') {
  let rows = {};
  try {
    rows = JSON.parse(await readFile(path, 'utf8'));
    if (!rows || Array.isArray(rows) || typeof rows !== 'object') throw new Error('Invalid store');
    for (const [id, row] of Object.entries(rows)) {
      if (!/^\d{17,20}$/.test(id) || !row || ['ownerId','guildId','channelId','webhookId'].some(k => !/^\d{17,20}$/.test(row[k]))) throw new Error('Invalid store');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw new Error('ownership_store_unavailable'); }
  let queue = Promise.resolve();
  const change = mutate => {
    const operation = queue.then(async () => {
      const next = {...rows}; mutate(next);
      await mkdir(dirname(path), {recursive:true,mode:0o700});
      const file = await open(path+'.tmp', 'w', 0o600);
      try { await file.writeFile(JSON.stringify(next)); await file.sync(); } finally { await file.close(); }
      await rename(path+'.tmp',path);
      rows = next;
    });
    queue = operation.catch(() => {});
    return operation;
  };
  return {
    get: id => rows[id] ? {...rows[id]} : null,
    put: (id,row) => change(next => {
      if (Object.keys(next).length >= 10000 && !next[id]) throw new Error('ownership_store_full');
      if (!/^\d{17,20}$/.test(id) || ['ownerId','guildId','channelId','webhookId'].some(k => !/^\d{17,20}$/.test(row[k]))) throw new Error('Invalid record');
      next[id] = {ownerId:row.ownerId,guildId:row.guildId,channelId:row.channelId,webhookId:row.webhookId};
    }),
    remove: id => change(next => { delete next[id]; })
  };
}
