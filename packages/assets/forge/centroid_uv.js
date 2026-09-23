/** Keep MSAA texture interpolation inside tiny, independently charted faces.
 * Fragment-center extrapolation can cross a chart even when every bilinear
 * edge tap is padded. Centroid interpolation changes no texture/mesh bytes.
 */
const configured=new WeakSet();
export function applyProjectionCentroid(THREE,material,{declare=false}={}){
  if(declare)material.userData.rinneProjectionUv='centroid-triangle-atlas-v1';
  if(material.userData.rinneProjectionUv!=='centroid-triangle-atlas-v1'||configured.has(material))return material;
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  const centroid=chunk=>chunk.replace(/\bvarying\s+vec2\s+(v\w*Uv|vUv)\s*;/g,'centroid varying vec2 $1;');
  material.onBeforeCompile=function(shader,renderer){
    previous.call(this,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <uv_pars_vertex>',centroid(THREE.ShaderChunk.uv_pars_vertex));
    shader.fragmentShader=shader.fragmentShader.replace('#include <uv_pars_fragment>',centroid(THREE.ShaderChunk.uv_pars_fragment));
  };
  material.customProgramCacheKey=function(){return previousKey.call(this)+'|rinne-centroid-uv-v1';};
  configured.add(material);material.needsUpdate=true;return material;
}
