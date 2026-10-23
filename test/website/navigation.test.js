import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../src/website/',import.meta.url);
const expected=[['index.html','Overview'],['help.html','Help'],['contact.html','Contact'],['privacy.html','Privacy'],['terms.html','Terms']];
test('every page keeps identical navigation order and only marks its own active item',async()=>{
 for(const path of ['index.html','pages/help.html','pages/terms.html','pages/privacy.html','pages/contact/contact.html','pages/playground/playground.html']){
  const html=await readFile(new URL(path,root),'utf8');
  const nav=html.match(/<nav id="main-navigation" aria-label="Main navigation">([\s\S]*?)<\/nav>/)?.[1];assert.ok(nav,path);
  const links=[...nav.matchAll(/<a href="([^"]+)"([^>]*)>([^<]+)<\/a>/g)];
  assert.deepEqual(links.map(x=>[x[1],x[3]]),expected,path);
  assert.deepEqual(links.filter(x=>x[2].includes('aria-current="page"')).map(x=>x[1]),(path.endsWith('/playground.html')?[]:[path.split('/').pop()]),path);
  assert.ok(html.includes('navigation.css?v=nav-3'),path);
  assert.ok(html.includes('navigation.js?v=nav-3'),path);
  assert.match(html, /<button class="nav-toggle" type="button" aria-label="Open navigation" aria-expanded="false" aria-controls="main-navigation" hidden>/);
 }
});
test('navigation uses fixed desktop and narrow-screen slots without active font resizing',async()=>{
 const css=await readFile(new URL('navigation.css',root),'utf8');
 assert.match(css,/grid-template-columns: repeat\(5, max-content\)/);
 assert.match(css,/grid-template-columns: minmax\(0, 1fr\)/);
 assert.doesNotMatch(css,/(?:^|[;{])\s*order\s*:|row-reverse/);
 assert.match(css,/\.site-header nav a \{[^}]*font-weight: 700/s);
 assert.match(css,/\.site-header nav a\[aria-current="page"\] \{[^}]*font-weight: 700/s);
});

test('mobile disclosure maintains state and closes on Escape, outside focus, and resize',async()=>{
 const {runInNewContext}=await import('node:vm');
 const events={},classes=new Set(),attrs={'aria-expanded':'false'};let focused=false;
 const toggle={hidden:true,setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k],addEventListener:(k,f)=>events['button:'+k]=f,focus:()=>{focused=true;}};
 const nav={contains:()=>false,querySelector:()=>({focus(){}})};
 const header={querySelector:s=>s==='.nav-toggle'?toggle:nav,contains:t=>t==='inside',classList:{add:s=>classes.add(s),toggle:(s,on)=>on?classes.add(s):classes.delete(s)}};
 const mobile={matches:true,addEventListener:(k,f)=>events.resize=f};
 const document={querySelector:()=>header,addEventListener:(k,f)=>events[k]=f};
 const window={matchMedia:()=>mobile,addEventListener:(k,f)=>events[k]=f};
 runInNewContext(await readFile(new URL('navigation.js',root),'utf8'),{document,window});
 assert.equal(toggle.hidden,false);assert.ok(classes.has('nav-ready'));
 events['button:click']();assert.equal(attrs['aria-expanded'],'true');assert.equal(attrs['aria-label'],'Close navigation');
 events.keydown({key:'Escape'});assert.equal(attrs['aria-expanded'],'false');assert.equal(focused,true);
 events['button:click']();events.focusin({target:'outside'});assert.equal(attrs['aria-expanded'],'false');
 events['button:click']();events.click({target:{closest:()=>null}});assert.equal(attrs['aria-expanded'],'false');
 events['button:click']();events.resize();assert.equal(attrs['aria-expanded'],'false');
 events['button:click']();events.pageshow();assert.equal(attrs['aria-expanded'],'false');
});
