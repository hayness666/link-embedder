import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../docs/contact.js', import.meta.url), 'utf8');
function setup() {
  const callbacks = {};
  const button = { disabled: false };
  const status = { textContent: '' };
  const panel = { hidden: false };
  const trap = { value: '' };
  const form = { checkValidity: () => true, reportValidity() {}, querySelector: () => button,
    addEventListener: (name, fn) => { callbacks[name] = fn; } };
  const frame = { addEventListener: (name, fn) => { callbacks[`frame:${name}`] = fn; } };
  const elements = { '#contact-form': form, '#contact-form-response': frame,
    '#form-response-panel': panel, '#form-status': status, '#contact-website': trap };
  let timeout;
  let now = 100000;
  const navigator = { onLine: true };
  runInNewContext(script, { document: { querySelector: id => elements[id] }, navigator,
    Date: { now: () => now }, setTimeout: fn => { timeout = fn; }, clearTimeout: () => { timeout = null; } });
  return { form, button, status, panel, trap, callbacks, navigator,
    tick: ms => { now += ms; }, timeout: () => timeout?.(),
    submit() { let blocked = false; callbacks.submit({ preventDefault() { blocked = true; } }); return blocked; } };
}

test('blocks honeypot, invalid fields, offline and rapid duplicate submissions', () => {
  const x = setup();
  x.trap.value = 'spam'; assert.equal(x.submit(), true);
  x.trap.value = ''; x.navigator.onLine = false; assert.equal(x.submit(), true);
  x.navigator.onLine = true; x.form.checkValidity = () => false; assert.equal(x.submit(), true);
  x.form.checkValidity = () => true; assert.equal(x.submit(), false);
  assert.equal(x.button.disabled, true); assert.equal(x.submit(), true);
  x.callbacks['frame:load'](); assert.equal(x.submit(), true);
  x.tick(30001); assert.equal(x.submit(), false);
});

test('a cross-origin frame load never claims success or clears the message', () => {
  const x = setup();
  x.form.reset = () => assert.fail('must not discard message');
  x.callbacks['frame:load'](); assert.equal(x.panel.hidden, true);
  x.submit(); x.callbacks['frame:load']();
  assert.equal(x.panel.hidden, false); assert.equal(x.button.disabled, false);
  assert.match(x.status.textContent, /confirmation or validation errors/);
  assert.doesNotMatch(x.status.textContent, /has been sent|successfully sent/);
});

test('timeouts and frame failures preserve input and provide a fallback', () => {
  for (const failure of ['timeout', 'error']) {
    const x = setup(); x.submit();
    if (failure === 'timeout') x.timeout(); else x.callbacks['frame:error']();
    assert.equal(x.button.disabled, false);
    assert.match(x.status.textContent, /Google Form link/);
    assert.match(x.status.textContent, /still in the form/);
  }
});
