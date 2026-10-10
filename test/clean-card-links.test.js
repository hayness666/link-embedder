import test from 'node:test';import assert from 'node:assert/strict';
import {cleanCardLinks} from '../src/repost.js';
import {buildRepostPayload} from '../src/repost.js';
test('visible card links lose trackers while functional parameters and prose survive',()=>{
 const raw='hello https://www.instagram.com/p/ABC/?img_index=2&utm_source=copy&igsh=example';
 assert.equal(cleanCardLinks(raw),'hello https://www.instagram.com/p/ABC/?img_index=2');
 assert.equal(cleanCardLinks('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12&si=track'),'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=12');
 assert.equal(cleanCardLinks('https://www.facebook.com/photo?fbid=123&set=a.4&fbclid=track'),'https://www.facebook.com/photo?fbid=123');
 assert.equal(cleanCardLinks('https://www.instagram.com/share/ABC?igsh=track'),'https://www.instagram.com/share/ABC');
 assert.equal(cleanCardLinks('https://example.com/p?utm_source=keep'),'https://example.com/p?utm_source=keep');
 const m={content:raw,author:{username:'Person'}};const p=buildRepostPayload(m,{flags:32768,components:[{type:10,content:raw}]});assert.equal(p.components[0].content,cleanCardLinks(raw));assert.equal(m.content,raw);
});
