import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCharacterReferences } from '../ops-board/character-references.mjs';

test('PULSE character references groups repository image assets without exposing GitHub API to the browser', async () => {
  const calls = [];
  const fixtures = new Map([
    ['/contents/docs/characters/references?ref=develop', [
      { name:'README.md', type:'file' },
      { name:'shino', type:'dir', html_url:'https://github.com/charukun/soul-lineage/tree/develop/docs/characters/references/shino' },
      { name:'npc-role-set', type:'dir', html_url:'https://github.com/charukun/soul-lineage/tree/develop/docs/characters/references/npc-role-set' },
    ]],
    ['/contents/docs/characters/references/shino?ref=develop', [
      { name:'shino-character-reference-sheet-v2.png', type:'file', size:100, download_url:'https://raw.githubusercontent.com/charukun/soul-lineage/develop/docs/characters/references/shino/shino-character-reference-sheet-v2.png', html_url:'https://github.com/charukun/soul-lineage/blob/develop/docs/characters/references/shino/shino-character-reference-sheet-v2.png' },
    ]],
    ['/contents/docs/characters/references/npc-role-set?ref=develop', [
      { name:'README.md', type:'file', html_url:'https://github.com/charukun/soul-lineage/blob/develop/docs/characters/references/npc-role-set/README.md' },
      { name:'guard.avif', type:'file', size:42, download_url:'https://raw.githubusercontent.com/charukun/soul-lineage/develop/docs/characters/references/npc-role-set/guard.avif', html_url:'https://github.com/charukun/soul-lineage/blob/develop/docs/characters/references/npc-role-set/guard.avif' },
      { name:'notes.txt', type:'file', download_url:'https://raw.githubusercontent.com/example/notes.txt' },
    ]],
  ]);
  const client = { get: async path => { calls.push(path); return { data: fixtures.get(path) }; } };
  const result = await collectCharacterReferences(client);

  assert.equal(result.totalGroups, 2);
  assert.equal(result.totalAssets, 2);
  assert.equal(result.groups[0].title, 'NPC Role Set');
  assert.equal(result.groups[1].title, 'Shino');
  assert.equal(result.groups[1].primaryAsset.name, 'shino-character-reference-sheet-v2.png');
  assert.equal(result.groups[0].readmeUrl.endsWith('/README.md'), true);
  assert.deepEqual(calls, [
    '/contents/docs/characters/references?ref=develop',
    '/contents/docs/characters/references/npc-role-set?ref=develop',
    '/contents/docs/characters/references/shino?ref=develop',
  ]);
});
