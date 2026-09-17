export function directDependencyCount(source) {
  const dependencies = new Set();
  const patterns = [
    /(?:^|[;\n])\s*import\s+(?:[^'\"\n;]+?\s+from\s+)?['\"]([^'\"]+)['\"]/gm,
    /(?:^|[;\n])\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['\"]([^'\"]+)['\"]/gm,
    /\brequire\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) dependencies.add(match[1]);
  }
  return dependencies.size;
}
