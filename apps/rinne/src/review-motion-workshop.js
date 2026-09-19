import { loadMotionManifest, motionCountLabel } from './review-motion-manifest.js';
import './review-motion-workshop.css';

// The Character Workshop remains the public entrypoint. Reuse the existing
// motion-review renderer inside it; do not revive the retired VRM QA source.
const root = document.getElementById('motion-qa');
if (root) {
  const section = document.createElement('section'); section.id = 'workshop-motion-library'; section.setAttribute('aria-label', '実ソースモーションの演舞レビュー');
  const heading = document.createElement('h3'); heading.textContent = '実ソースモーション';
  const count = document.createElement('output'); count.id = 'workshop-motion-count'; count.textContent = 'MOTION CLIPS …';
  const open = document.createElement('button'); open.type = 'button'; open.id = 'workshop-motion-open'; open.className = 'primary'; open.textContent = 'モーション一覧・30秒演舞';
  const note = document.createElement('p'); note.className = 'hint'; note.textContent = '生活・移動・戦闘・リアクション。すべてから全件を選択できます。モデルや速度の違いは本数に含めません。';
  const state = document.createElement('p'); state.id = 'workshop-motion-library-status'; state.setAttribute('role', 'status');
  section.append(heading, count, open, note, state); root.prepend(section);

  const dialog = document.createElement('dialog'); dialog.id = 'workshop-motion-dialog'; dialog.setAttribute('aria-labelledby', 'workshop-motion-dialog-title');
  const header = document.createElement('header'), title = document.createElement('h2'), close = document.createElement('button');
  title.id = 'workshop-motion-dialog-title'; title.textContent = '演舞レビュー'; close.type = 'button'; close.id = 'workshop-motion-close'; close.textContent = '工房へ戻る';
  const frame = document.createElement('iframe'); frame.id = 'workshop-motion-viewer'; frame.title = '演舞レビューの実モーション一覧';
  header.append(title, close); dialog.append(header, frame); document.body.append(dialog);
  let pausedBefore = false;
  open.addEventListener('click', () => {
    const review = window.masterCharacterReview;
    pausedBefore = Boolean(review?.settings?.paused); review?.motionQA?.stop?.(); review?.configure?.({ paused: true });
    // No motion binary is requested before this explicit user action.
    frame.src = new URL('./review-motion.html?embedded=1', location.href).href;
    dialog.showModal(); close.focus();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    frame.src = 'about:blank'; window.masterCharacterReview?.configure?.({ paused: pausedBefore }); open.focus();
  });
  void loadMotionManifest().then(manifest => {
    count.textContent = motionCountLabel(manifest.records);
    state.textContent = '出典・固定ハッシュ・ライセンス付き。旧QA記録と本編の保存は変更しません。';
    section.dataset.motionCount = String(manifest.records.length);
  }).catch(error => { state.textContent = 'モーション台帳を読み込めませんでした: ' + error.message; });
}
