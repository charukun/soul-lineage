/** Pack semantic controls into pages without changing their DOM ownership or handlers. */
export function packPages(chapters, height, gap = 8) {
  const pages = [];
  for (const chapter of chapters) {
    let page = [], used = 0;
    for (const item of chapter.items) {
      const cost = Math.ceil(item.height) + (page.length ? gap : 0);
      if (page.length && used + cost > height) {
        pages.push({title: chapter.title, items: page}); page = []; used = 0;
      }
      page.push(item); used += Math.ceil(item.height) + (page.length > 1 ? gap : 0);
    }
    if (page.length) pages.push({title: chapter.title, items: page});
  }
  return pages;
}

export function mountPageLayout(host, {chapters, label = '手帳のページ', watch = []} = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const abort = new win.AbortController(), signal = abort.signal;
  const flow = doc.createElement('div'), viewport = doc.createElement('div'), nav = doc.createElement('nav');
  const previous = doc.createElement('button'), next = doc.createElement('button'), select = doc.createElement('select');
  flow.className = 'book-flow'; viewport.className = 'book-viewport'; nav.className = 'book-pages';
  previous.type = next.type = 'button'; previous.textContent = '〈'; next.textContent = '〉';
  previous.setAttribute('aria-label', '前のページ'); next.setAttribute('aria-label', '次のページ');
  select.setAttribute('aria-label', label); nav.setAttribute('aria-label', label);
  flow.append(...host.childNodes); viewport.append(flow); nav.append(previous, select, next); host.append(viewport, nav);
  host.classList.add('page-book'); let pages = [], index = 0, frame = 0, disposed = false, measured = new Set();
  function draw(focus = false) {
    index = Math.max(0, Math.min(index, pages.length - 1));
    const active = new Set(pages[index]?.items.map(item => item.node));
    for (const node of measured) node.toggleAttribute('data-page-away', !active.has(node));
    select.value = String(index); previous.disabled = index === 0; next.disabled = index >= pages.length - 1;
    const needsScroll = flow.scrollHeight > viewport.clientHeight + 1;
    // Only an indivisible control larger than the available viewport may scroll (zoom/keyboard).
    viewport.dataset.overflow = needsScroll ? 'necessary' : 'none'; viewport.scrollTop = 0;
    if (focus) select.focus({preventScroll: true});
  }
  function layout() {
    frame = 0; if (disposed || !host.getClientRects().length || viewport.clientHeight < 1) return;
    const anchor = pages[index]?.items[0]?.node, oldTitle = pages[index]?.title;
    for (const node of measured) { node.removeAttribute('data-page-away'); node.removeAttribute('data-book-unit'); }
    measured = new Set();
    const groups = chapters().map(chapter => ({title: chapter.title, items: chapter.nodes.filter(Boolean).flatMap(node => {
      node.setAttribute('data-book-unit', '');
      if (!node.getClientRects().length) return [];
      measured.add(node); return [{node, height: node.getBoundingClientRect().height}];
    })}));
    pages = packPages(groups, viewport.clientHeight);
    // Legacy controls can retain internal gaps. Verify the actual rendered page too.
    for(let i=0;i<pages.length;i++){
      const page=pages[i];let moved=[];
      while(page.items.length>1){
        const active=new Set(page.items.map(item=>item.node));
        for(const node of measured)node.toggleAttribute('data-page-away',!active.has(node));
        if(flow.scrollHeight<=viewport.clientHeight+1)break;
        moved.unshift(page.items.pop());
      }
      if(moved.length)pages.splice(i+1,0,{title:page.title,items:moved});
    }
    if (!pages.length) pages = [{title: '表示する項目はありません', items: []}];
    const same = pages.findIndex(p => p.items.some(item => item.node === anchor));
    index = same >= 0 ? same : Math.max(0, pages.findIndex(p => p.title === oldTitle));
    select.replaceChildren(...pages.map((p, i) => {const option = doc.createElement('option'); option.value = String(i); option.textContent = `${p.title}　${i + 1} / ${pages.length}`; return option;}));
    draw();
  }
  function refresh() { if (!frame && !disposed) frame = win.requestAnimationFrame(layout); }
  previous.addEventListener('click', () => { index--; draw(); }, {signal});
  next.addEventListener('click', () => { index++; draw(); }, {signal});
  select.addEventListener('change', () => { index = Number(select.value); draw(); }, {signal});
  for (const type of ['click', 'input', 'change', 'toggle']) flow.addEventListener(type, refresh, {signal, capture:true});
  const observer = new win.MutationObserver(refresh);
  for (const node of watch) if (node) observer.observe(node, {childList:true});
  const resize = new win.ResizeObserver(refresh); resize.observe(viewport);
  doc.fonts?.addEventListener('loadingdone',refresh,{signal});
  function showNode(node) {const i = pages.findIndex(p => p.items.some(item => item.node === node || item.node.contains(node))); if (i >= 0) { index = i; draw(); }}
  // Native catalog keyboard navigation must never focus an item on an invisible page.
  flow.addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key) || !event.target.closest('.picker-option')) return;
    const options = pages.flatMap(p => p.items.map(item => item.node)).filter(node => node.matches('.picker-option'));
    if (!options.length) return; event.preventDefault(); event.stopPropagation();
    const current = options.indexOf(event.target.closest('.picker-option'));
    const i = event.key === 'Home' ? 0 : event.key === 'End' ? options.length-1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    showNode(options[i]); options[i].focus({preventScroll:true});
  }, {signal,capture:true});
  refresh();
  return {refresh, showNode, destroy() {
    disposed = true; abort.abort(); observer.disconnect(); resize.disconnect(); win.cancelAnimationFrame(frame);
    for (const node of measured) {node.removeAttribute('data-page-away'); node.removeAttribute('data-book-unit');}
    host.append(...flow.childNodes); viewport.remove(); nav.remove(); host.classList.remove('page-book');
  }};
}
