import { parseAst } from 'vite';

// Parse real imports/asset references. HTML such as id="after-import" and
// strings containing "from" must not be interpreted as dependencies.
const isImportMetaUrl=node=>node?.type==='MemberExpression'
  && node.computed===false
  && node.property?.name==='url'
  && node.object?.type==='MetaProperty'
  && node.object.meta?.name==='import'
  && node.object.property?.name==='meta';

export function importSpecifiers(source) {
  const specs = [];
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type)
        && typeof node.source?.value === 'string') specs.push(node.source.value);
    if (node.type === 'NewExpression' && node.callee?.name === 'URL'
        && typeof node.arguments[0]?.value === 'string'
        && !node.arguments[0].value.endsWith('/')
        && isImportMetaUrl(node.arguments[1])) specs.push(node.arguments[0].value);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  };
  walk(parseAst(source));
  return specs;
}
