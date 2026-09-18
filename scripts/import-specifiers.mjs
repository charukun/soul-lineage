import { parseAst } from 'vite';

// Parse real imports/asset references. HTML such as id="after-import" and
// strings containing "from" must not be interpreted as dependencies.
export function importSpecifiers(source) {
  const specs = [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)
        && typeof node.source?.value === 'string') specs.push(node.source.value);
    if (node.type === 'NewExpression' && node.callee?.name === 'URL'
        && typeof node.arguments[0]?.value === 'string') specs.push(node.arguments[0].value);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  };
  walk(parseAst(source));
  return specs;
}
