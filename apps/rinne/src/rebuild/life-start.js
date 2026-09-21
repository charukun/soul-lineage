import { createLife, deserializeLife, serializeLife } from './domain.js';
import { normalizeClanOrigin } from './clan-origin.js';

/** Resolve the life before activating input, clocks, guides or autosave. */
export async function resolveSoloLifeStart({mode,storage,saveKey,name,seed,villageIds,clanOrigin,expectedSave,place=state=>state}) {
  if(!storage||typeof storage.read!=='function'||typeof storage.write!=='function')throw Error('保存先を開けませんでした。');
  if(mode!=='new'&&mode!=='continue')throw Error('人生の開始方法が不正です。');
  const current=(await storage.read(saveKey))??null;
  if(mode==='continue'){
    if(current===null)throw Error('続きから遊べる保存データがありません。');
    // Never fall through to new-life creation when a save is missing or corrupt.
    return place(deserializeLife(current));
  }
  const origin=normalizeClanOrigin(clanOrigin);
  if(!origin)throw Error('生まれる一族の記憶を選んでください。');
  if(expectedSave===undefined||current!==expectedSave)throw Error('保存された人生が変わりました。タイトルへ戻り、もう一度確認してください。');
  const state=place(createLife({name,seed,villageIds,clanOrigin:origin}));
  const serialized=serializeLife(state);
  // The browser storage implementation uses one atomic setItem. A rejected write
  // leaves the old save intact and the runtime has not yet installed any handlers.
  const result=await storage.write(saveKey,serialized);
  if(result===false)throw Error('一族を保存できませんでした。端末の空き容量と保存設定をご確認ください。');
  return state;
}
