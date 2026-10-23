import test from 'node:test';
import assert from 'node:assert/strict';
import {plain,shortQuote} from '../../src/card-format.js';
import {simpleCard} from '../../src/simple-cards.js';
test('source list and heading markers remain literal punctuation with line breaks preserved',()=>{
 assert.equal(plain('Text\n\n- Jacob R., Science Lead'),'Text\n\n\\- Jacob R., Science Lead');
 for(const [source,expected] of [['- item','\\- item'],['  + item','  \\+ item'],['1. item','1\\. item'],['2) item','2\\) item'],['# Heading','\\# Heading'],['## Heading','\\#\\# Heading'],['> source quote','\\> source quote'],['well-known - middle','well-known - middle']])assert.equal(plain(source),expected);
 assert.equal(plain('* item'),'\\* item');
 assert.equal(shortQuote('- literal quote'),'\\- literal quote');
});
test('Threads text preserves a hyphen signature without changing generated author and quote structure',()=>{
 const card=simpleCard({platform:'threads',url:'https://www.threads.com/@nasa/post/DePd-h_lD3p'},{name:'NASA',username:'nasa',caption:'Main text\n\n- Jacob R., Science Lead',quote:{name:'Author',username:'author',text:'- literal quote',threadsQuote:true}});
 assert.ok(card.components.some(c=>c.content==='Main text\n\n\\- Jacob R., Science Lead'));
 assert.ok(card.components.some(c=>c.content==='**NASA** @\u200bnasa'));
 assert.ok(card.components.some(c=>c.content==='> **Author** @\u200bauthor\n> \\- literal quote'));
 assert.ok(card.components[0].content.startsWith('**[Threads Post]('));
});
