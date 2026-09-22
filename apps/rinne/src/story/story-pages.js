import {mountPageLayout} from './page-layout.js';

export function mountStoryPages(win) {
  const doc=win.document,$=id=>doc.getElementById(id),books=[];
  const flatten=node=>node?.classList.add('book-structure');
  function mount(id,chapters,watch){
    const dialog=$(id),header=dialog.querySelector('.sheet-heading');
    const body=doc.createElement('div');body.className='book-flex-body';
    body.append(...[...dialog.children].filter(node=>node!==header));dialog.append(body);dialog.classList.add('story-page-dialog');
    const book=mountPageLayout(body,{chapters,label:'手帳のページ',watch});books.push(book);
    const observer=new win.MutationObserver(()=>book.refresh());observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    books.push({destroy:()=>observer.disconnect()});
  }
  flatten($('story-choice-buttons'));
  mount('story-choice-dialog',()=>[{title:'近くの行動',nodes:[$('story-choice-description'),...$('story-choice-buttons').children]}],[$('story-choice-buttons')]);
  flatten($('story-map-list'));flatten($('story-companions'));flatten($('story-companions').querySelector('ul'));
  mount('story-map-dialog',()=>[
    {title:'村の地図',nodes:[$('story-map-dialog').querySelector('.map-instruction'),$('story-map-surface')]},
    {title:'行き先',nodes:[...$('story-map-list').children]},
    {title:'旅人',nodes:[...$('story-companions').querySelectorAll('h3,li')]},
  ],[$('story-map-list'),$('story-companions').querySelector('ul')]);
  const menu=$('story-menu-dialog');flatten(menu.querySelector('.travel-menu'));flatten(menu.querySelector('.play-guide'));
  mount('story-menu-dialog',()=>[
    {title:'旅支度',nodes:[...menu.querySelector('.travel-menu').children]},
    {title:'冒険の手引き',nodes:[...menu.querySelector('.play-guide').children]},
  ]);
  const records=$('story-dialog'),head=doc.createElement('header');head.className='sheet-heading';
  head.append($('story-dialog-title'),$('story-close'));records.prepend(head);$('story-close').classList.add('sheet-close');$('story-close').textContent='×';$('story-close').setAttribute('aria-label','記録を閉じる');
  flatten($('story-dialog-content'));flatten(records.querySelector('.story-dialog-actions'));
  mount('story-dialog',()=>{
    const content=$('story-dialog-content');flatten(content.querySelector('.story-place-list'));
    return [{title:'暮らしの記録',nodes:[...content.querySelectorAll('p')]},{title:'保存・読込',nodes:[...records.querySelectorAll('.story-dialog-actions>button')]}];
  },[$('story-dialog-content')]);
  return()=>{for(const book of books.reverse())book.destroy();};
}
