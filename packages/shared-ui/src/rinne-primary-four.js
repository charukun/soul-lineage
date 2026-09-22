const BUTTONS=Object.freeze([
  Object.freeze({attr:'data-heart',className:'is-heart',glyph:'心',label:'心得'}),
  Object.freeze({attr:'data-techniques',className:'is-technique',glyph:'技',label:'技'}),
  Object.freeze({attr:'data-body',className:'is-body',glyph:'体',label:'身法'}),
  Object.freeze({attr:'data-items',className:'is-items',glyph:'装',label:'武具'})
]);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function rinnePrimaryFourMarkup({ariaLabel='主要操作',extraClass=''}={}){
  const classes=['rinne-bottom-controls','rinne-primary-four',String(extraClass||'').trim()].filter(Boolean).join(' ');
  const buttons=BUTTONS.map(row=>'<button '+row.attr+' class="upgrade-control '+row.className+'" type="button"><i aria-hidden="true">'+row.glyph+'</i><span>'+row.label+'</span></button>').join('');
  return '<nav class="'+esc(classes)+'" aria-label="'+esc(ariaLabel)+'">'+buttons+'</nav>';
}
export const RINNE_PRIMARY_FOUR_BUTTONS=BUTTONS;
