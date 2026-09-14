import {mountPageLayout} from '../story/page-layout.js';
import '../story/page-layout.css';
import './menu-pages.css';

/** Rinne presentation around the shared music player and the existing peer-code flow. */
export function mountTitleMenuPages(doc=document) {
  const books=[],observers=[];
  function mount(dialog,title,close,chapters,watch=[]){
    const head=doc.createElement('header'),body=doc.createElement('div');head.className='menu-page-head';body.className='menu-page-body';
    head.append(title,close);body.append(...dialog.childNodes);dialog.append(head,body);dialog.classList.add('menu-page-dialog');
    const book=mountPageLayout(body,{chapters,label:'表示するページ',watch});books.push(book);
    const observer=new MutationObserver(()=>book.refresh());observer.observe(dialog,{attributes:true,attributeFilter:['open']});observers.push(observer);
  }
  const settings=doc.getElementById('settings-dialog'),title=doc.getElementById('settings-title'),close=settings.querySelector('form');
  settings.querySelector('.dialog-star').classList.add('book-caption');
  mount(settings,title,close,()=>[{title:'旅の支度',nodes:[...settings.querySelector('.book-flow').children].filter(n=>!n.classList.contains('book-caption'))}]);
  const music=doc.querySelector('.soul-music dialog');
  if(music){
    const title=music.querySelector('h2'),close=music.querySelector('form'),tracks=music.querySelector('[data-tracks]'),details=music.querySelector('details');
    tracks.classList.add('book-structure');details.open=true;details.classList.add('book-structure');
    const labels=[...music.querySelectorAll(':scope>label')],intro=[...music.querySelectorAll(':scope>p:not([data-state]):not([data-count])')];
    mount(music,title,close,()=>[
      {title:'曲の絞り込み',nodes:[...labels.filter(n=>!n.querySelector('[data-volume]')),music.querySelector('[data-count]')]},
      {title:'曲を選ぶ',nodes:[...tracks.children]},
      {title:'再生・音量',nodes:[music.querySelector('[data-state]'),music.querySelector('audio'),labels.find(n=>n.querySelector('[data-volume]')),music.querySelector('[data-stop]')]},
      {title:'音楽室の案内',nodes:[...intro,...details.children]},
    ],[tracks]);
  }
  const village=doc.getElementById('village-dialog'),section=doc.querySelector('#village-panel>section');
  if(village&&section){
    const heading=section.querySelector('h2'),close=village.querySelector('form');
    for(const node of [doc.getElementById('village-panel'),section])node.classList.add('book-structure');
    mount(village,heading,close,()=>[
      {title:'参加コード',nodes:[doc.getElementById('peer-state'),section.querySelector('label[for=host-offer]'),doc.getElementById('host-offer'),doc.getElementById('join-peer')]},
      {title:'村長へ返答',nodes:[section.querySelector('label[for=peer-answer]'),doc.getElementById('peer-answer')]},
      {title:'村を歩く',nodes:[section.querySelector('.peer-movement'),doc.getElementById('raid-state'),section.querySelector('.peer-note')]},
    ]);
  }
  return()=>{for(const observer of observers)observer.disconnect();for(const book of books)book.destroy();};
}
