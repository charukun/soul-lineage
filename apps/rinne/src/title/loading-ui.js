/** Stage-local progress and active-time watchdog. No time-driven percentage. */
export class LoadingUI {
  constructor(get, onTimeout, {stallMS=90000, totalMS=240000}={}) {
    this.$=get; this.onTimeout=onTimeout; this.stallMS=stallMS; this.totalMS=totalMS;
    this.timer=0; this.elapsed=0; this.idle=0; this.last=0; this.data={}; this.history=[];
  }
  start() {
    this.stop();this.elapsed=0;this.idle=0;this.last=performance.now();this.signature='';this.history=[];
    this.$('loading-heading').textContent='稽古場へ';this.$('loading-error').hidden=true;
    this.$('loading-details').open=false;this.$('loading-hint').textContent='この工程の進捗を表示しています。左上から中止できます。';
    this.$('retry-load').hidden=true;this.$('loading-time').textContent='経過 0秒';
    this.update({stage:'package',message:'起動データを準備しています'});
    this.timer=setInterval(()=>{
      const now=performance.now(),delta=now-this.last;this.last=now;
      if(document.hidden)return;
      this.elapsed+=delta;this.idle+=delta;
      this.$('loading-time').textContent=`経過 ${Math.floor(this.elapsed/1000)}秒`;
      this.$('loading-wait').textContent=this.idle>=15000?`進捗の更新が ${Math.floor(this.idle/1000)}秒ありません`:'';
      if(this.idle>=this.stallMS||this.elapsed>=this.totalMS){this.stop();this.onTimeout('読み込みの進捗を確認できませんでした。もう一度読み込むか、タイトルに戻ってください。','LOAD_TIMEOUT');}
    },500);
  }
  update(data) {
    if(!data||typeof data!=='object')return;
    this.data={...data};
    const signature=JSON.stringify(data);
    if(signature!==this.signature){this.idle=0;this.signature=signature;this.history.push({...data,elapsed:Math.floor(this.elapsed)});if(this.history.length>140)this.history.shift();}
    const names={package:'起動データ',engine:'ゲーム起動',model:'キャラクター',motion:'モーション',render:'画面の描画',ready:'準備完了'};
    const order=['package','engine','model','motion','render','ready'];
    const stage=order.includes(data.stage)?data.stage:'engine';
    this.$('loading-stage').textContent=`${order.indexOf(stage)+1} / 6　${names[stage]}`;
    this.$('loading-message').textContent=String(data.message||'処理中です').slice(0,300);
    const bar=this.$('loading-progress'),n=Number(data.loaded),total=Number(data.total);
    if(Number.isFinite(n)&&Number.isFinite(total)&&total>0&&n>=0){
      const ratio=Math.min(1,n/total);bar.value=ratio;this.$('loading-value').textContent=`${Math.floor(ratio*100)}%`;
      this.$('loading-count').textContent=data.unit==='bytes'?`${(n/1048576).toFixed(1)} / ${(total/1048576).toFixed(1)} MB`: `${n} / ${total} ${data.unit==='clips'?'本':''}`;
    }else{bar.removeAttribute('value');this.$('loading-value').textContent='処理中';this.$('loading-count').textContent=typeof data.detail==='string'?data.detail:'';}
    bar.setAttribute('aria-label',`${names[stage]}：この工程の進捗`);
    this.$('loading-wait').textContent='';
    this.$('loading-technical').textContent=JSON.stringify({build:'loading-fix-2',protocol:location.protocol,stage,...data},null,2);
  }
  fail(message,code='BOOT_ERROR',detail='') {
    this.stop();this.$('loading-heading').textContent='読み込みが止まりました';
    this.$('loading-message').textContent=message;this.$('loading-error').hidden=false;
    this.$('loading-error').textContent=`エラー：${code}`;this.$('retry-load').hidden=false;
    this.$('loading-hint').textContent='もう一度読み込むか、左上からタイトルに戻れます。';
    this.$('loading-value').textContent='停止';this.$('loading-progress').value=0;
    this.$('loading-technical').textContent=JSON.stringify({build:'loading-fix-2',protocol:location.protocol,code,message,detail,lastProgress:this.data,activeSeconds:Math.floor(this.elapsed/1000)},null,2);
  }
  stop(){clearInterval(this.timer);this.timer=0;}
  snapshot(){return{...this.data,activeSeconds:Math.floor(this.elapsed/1000),idleSeconds:Math.floor(this.idle/1000)};}
}
