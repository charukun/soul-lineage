/** A material shared by hair and clothing/skin is an atlas, not a hair-only surface.
 * Do not hide or recolor the whole atlas when an editor changes one body part.
 */
export function characterMaterialRole(name = '') {
  const roles = [[/HAIR/i, 'hair'], [/EyeIris/i, 'eyes'], [/SKIN/i, 'skin'], [/CLOTH/i, 'dye']]
    .filter(([pattern]) => pattern.test(name));
  return roles.length === 1 ? roles[0][1] : 'other';
}
