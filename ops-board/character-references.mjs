const IMAGE_FILE = /\.(?:png|jpe?g|webp|avif|gif)$/i;
const TITLES = Object.freeze({
  shino: 'Shino',
  'npc-role-set': 'NPC Role Set',
  'video-character-001': 'Video Character 001',
  'kirishiro-shizuha': '霧白静刃 / Kirishiro Shizuha',
});

function titleFor(id) {
  if (TITLES[id]) return TITLES[id];
  return id.split('-').filter(Boolean).map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function assetRank(file) {
  const name = file.name.toLowerCase();
  if (name.includes('character-reference-sheet')) return 0;
  if (name.includes('reference-sheet')) return 1;
  return 2;
}

export async function collectCharacterReferences(client) {
  const { data: root } = await client.get('/contents/docs/characters/references?ref=develop');
  if (!Array.isArray(root)) throw new Error('Character reference root returned a non-array payload');

  const groups = [];
  for (const entry of root.filter(item => item?.type === 'dir').sort((a, b) => a.name.localeCompare(b.name))) {
    const { data: files } = await client.get(`/contents/docs/characters/references/${encodeURIComponent(entry.name)}?ref=develop`);
    if (!Array.isArray(files)) continue;
    const readme = files.find(file => file.type === 'file' && file.name.toLowerCase() === 'readme.md');
    const assets = files
      .filter(file => file.type === 'file' && IMAGE_FILE.test(file.name) && /^https:\/\//.test(file.download_url || ''))
      .sort((a, b) => assetRank(a) - assetRank(b) || a.name.localeCompare(b.name))
      .map(file => ({ name: file.name, url: file.download_url, repositoryUrl: file.html_url, size: file.size || 0 }));
    if (!assets.length) continue;
    groups.push({
      id: entry.name,
      title: titleFor(entry.name),
      repositoryUrl: entry.html_url,
      readmeUrl: readme?.html_url || null,
      primaryAsset: assets[0],
      assets,
    });
  }

  return {
    source: 'docs/characters/references',
    branch: 'develop',
    groups,
    totalGroups: groups.length,
    totalAssets: groups.reduce((sum, group) => sum + group.assets.length, 0),
    stale: false,
  };
}
