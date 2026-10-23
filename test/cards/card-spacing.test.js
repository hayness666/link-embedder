import test from 'node:test';
import assert from 'node:assert/strict';
import {simpleCard} from '../../src/simple-cards.js';
import {parseInstagramCard} from '../../src/providers/instagram.js';
import {facebookNativePayload} from '../../src/providers/facebook.js';
import {brands} from '../../src/platform-brands.js';

function check(card) {
 assert.ok(card);
 const parts=card.components;
 assert.deepEqual(parts.filter(c=>c.type===14),[
  {type:14,divider:false,spacing:1}, {type:14,divider:true,spacing:1}
 ]);
 assert.equal(parts[1].type,14);
 assert.deepEqual(parts.at(-2),{type:14,divider:true,spacing:1});
 assert.match(parts.at(-1).content,/Link Embedder/);
 for(const [i,c] of parts.entries()) if(c.type===12) assert.ok(i>1 && i<parts.length-2);
}
test('every shared platform card keeps identical title spacing and footer divider, including fallback and quotes',()=>{
 for(const platform of Object.keys(brands)) {
  check(simpleCard({platform,url:"https://www.reddit.com/r/test/comments/abc/post"},{title:'Title',name:'Author',username:'author',caption:'Caption'}));
  check(simpleCard({platform,url:"https://www.reddit.com/r/test/comments/abc/post"},{title:'Title'}));
 }
 check(simpleCard({platform:'twitter'},{title:'Title',caption:'Main text',media:['https://pbs.twimg.com/photo.jpg'],quote:{url:'https://twitter.com/person/status/123',text:'Quote'}}));
 check(simpleCard({platform:'pinterest'},{title:'Title',media:['https://i.pinimg.com/photo.jpg']}));
 check(simpleCard({platform:'snapchat'},{title:'Title',media:['https://bolt-gcdn.sc-cdn.net/u/video']}));
});
test('Instagram helper and Facebook native cards use the same separator convention',()=>{
 const component={type:17,components:[{type:10,content:'Author @author'},{type:10,content:'Caption'},{type:12,items:[{media:{url:'https://oginstagram.com/offload/abc/1'}}]}]};
 check(parseInstagramCard(`<script id="discord:component-embed">${JSON.stringify({component})}</script>`,{platform:'instagram',url:'https://www.instagram.com/p/abc/'}));
 const url='https://www.facebook.com/photo.php?fbid=123';
 const payload=facebookNativePayload(url,[{url,title:'Photo',description:'Caption',image:{url:'https://scontent.xx.fbcdn.net/photo.jpg'}}]);
 check(payload?.components.find(c=>c.type===17));
});

test('Threads footer includes the registered app logo and standard attribution',()=>{
 const card=simpleCard({platform:'threads',url:'https://www.threads.com/@meta/post/DDzbnVKx57R'},{caption:'Text'});
 assert.equal(card.components.at(-1).content,'<:threadslogo:1562675521857519626>\u00a0\u00a0**Threads** via [Link Embedder](<https://discord.com/users/1557858203897823304>)');
});
