export const reviewVfxAssetFrom=(source,{sourcePath,targetPath=sourcePath,byteLength,gitBlobSha,reviewLibrary=false,infoVersion=null,dependencyRoot=null})=>Object.freeze({
  path:`review-library/${source.namespace}/${targetPath}`,sourcePath,byteLength,gitBlobSha,
  repository:source.repository,revision:source.revision,license:source.license,reviewOnly:true,
  ...(reviewLibrary?{reviewLibrary:true}:{}),
  ...(Number.isInteger(infoVersion)?{infoVersion}:{}),
  ...(dependencyRoot?{dependencyRoot:`review-library/${source.namespace}/${dependencyRoot}`}:{})
});
export const reviewVfxEffectFrom=(source,id,sourcePath,author,options={})=>Object.freeze({
  id,path:`review-library/${source.namespace}/${sourcePath}`,sourcePath,author,
  repository:source.repository,revision:source.revision,license:source.license,
  scale:options.scale??1,lifetime:options.lifetime??2,reviewOnly:true
});
