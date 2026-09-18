import test from 'node:test';
import assert from 'node:assert/strict';
import {AngledGuide} from '../src/web/angled-guide.js';

class FakeNode {
  constructor() { this.textContent = ''; this.children = []; this.listeners = {}; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
}
function fixture() {
  const parts = {
    '[data-guide-kicker]':new FakeNode(),
    '[data-guide-title]':new FakeNode(),
    '[data-guide-body]':new FakeNode(),
    '[data-guide-close]':new FakeNode()
  };
  const root = new FakeNode();
  root.hidden = true; root.dataset = {}; root.attributes = {};
  root.querySelector = selector => parts[selector];
  root.setAttribute = (name, value) => { root.attributes[name] = value; };
  return {root, parts};
}
globalThis.window = {clearTimeout, setTimeout};
globalThis.document = {
  createElement() { return new FakeNode(); },
  getElementById() { return null; }
};

test('angled guide shows, swaps content, supports both sides, and hides', () => {
  const {root, parts} = fixture();
  const guide = new AngledGuide(root);
  guide.show({side:'left', kicker:'捕食', title:'止まる', body:[{label:'倒れた獲物', text:'そばで止まる'}]});
  assert.equal(root.hidden, false);
  assert.equal(root.dataset.side, 'left');
  assert.equal(root.dataset.variant, 'normal');
  assert.equal(parts['[data-guide-title]'].textContent, '止まる');
  assert.equal(parts['[data-guide-body]'].children.length, 1);
  assert.equal(parts['[data-guide-body]'].children[0].children[1].textContent, 'そばで止まる');

  guide.show({side:'right', variant:'compact', title:'帰れる', body:'帰還口へ'});
  assert.equal(root.dataset.side, 'right');
  assert.equal(root.dataset.variant, 'compact');
  assert.equal(parts['[data-guide-body]'].children.length, 1);
  assert.equal(parts['[data-guide-body]'].children[0].textContent, '帰還口へ');

  parts['[data-guide-close]'].listeners.click();
  assert.equal(root.hidden, true);
  assert.equal(root.attributes['aria-hidden'], 'true');
});
