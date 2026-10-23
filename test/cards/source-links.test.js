import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceText,shortCaption,shortQuote,plain} from '../../src/card-format.js';
import {simpleCard} from '../../src/simple-cards.js';
test('body URLs show their safe destination, preserve punctuation, and remove only safe tracking',()=>{
 assert.equal(sourceText('- See https://example.com/a?x=1&utm_source=qa.'),'\\- See <https://example.com/a?x=1>.');
 assert.equal(sourceText('See (https://example.com/a_(b)).'),'See (<https://example.com/a_%28b%29>).');
 assert.match(sourceText('https://example.com/?token=signed&utm_source=required'),/utm/);
 assert.match(sourceText('http://example.com/path'),/<http:\/\/example.com\/path>/);
 assert.equal(sourceText('A\n- B\nhttps://example.com/'),'A\n\\- B\n<https://example.com/>');
});
test('source Markdown cannot conceal destinations or inject formatting and mentions',()=>{
 const rendered=sourceText('[trusted.example](https://evil.example/) @everyone **bold**');
 assert.ok(rendered.includes('<https://evil.example/>'));
 assert.ok(!rendered.includes('trusted.example'));
 assert.ok(rendered.includes('@\u200beveryone'));
 assert.ok(rendered.includes('\\*\\*bold\\*\\*'));
 for(const raw of ['javascript:alert(1)','data:text/html,test','ftp://example.com/file','https://user:password@example.com/']) assert.ok(!sourceText(raw).includes('<http'));
 assert.ok(!plain('https://example.com').includes('<http'));
});
test('caption and quote cutoff never activates an incomplete URL',()=>{
 for(const render of [shortCaption,shortQuote]) {
  const long='a'.repeat(290)+' https://example.com/long';
  assert.ok(!render(long).includes('<http'));
  assert.ok(render(long).endsWith('…'));
  assert.match(render('See https://example.com/'),/<https:/);
  assert.match(render('😀'.repeat(275)+' https://example.com/'),/<https:/);
 }
});
test('shared card bodies and quoted text use links while headings stay generated',()=>{
 for(const platform of ['threads','twitter','bluesky']) {
 const quoteUrl=platform==='threads'?undefined:platform==='twitter'?'https://twitter.com/person/status/123':'https://bsky.app/profile/person.test/post/abc';
 const card=simpleCard({platform},{caption:'- https://example.com/main',quote:{text:'https://example.com/quote',url:quoteUrl,threadsQuote:platform==='threads'}});
 const text=card.components.map(c=>c.content||'').join('\n');
 assert.ok(text.includes('<https://example.com/main>'));
 assert.ok(text.includes('<https://example.com/quote>'));
 assert.ok(text.includes('\\- '));
 }
});
