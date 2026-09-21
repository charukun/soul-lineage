// Small, first-party vector memories. No remote assets, fonts, video or extra WebGL context.
const wrap=body=>`<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const pool='<ellipse cx="100" cy="129" rx="75" ry="10" fill="#7bd4c2" opacity=".13"/>';
const stars='<g fill="#fff2ca"><circle cx="31" cy="31" r="2"/><circle cx="164" cy="43" r="2"/><circle cx="152" cy="20" r="1.4"/></g>';
const windowLight='<path d="M91 90h18v25H91z" fill="#ffe6aa"/><path d="M100 90v25m-9-13h18" stroke="#747c75" stroke-width="2"/>';
const houses={
  wa:`<path d="M10 108 48 40 92 111M101 106l46-74 46 76" fill="#477c80" opacity=".55"/><path d="M44 74h112v45H44z" fill="#c3d5bd"/><path d="m33 78 22-13 45-28 45 28 22 13-35-4H68z" fill="#384b68" stroke="#b0d4c9" stroke-width="3"/><path d="M50 116h100m-92-34v32m84-32v32m-87-6h90" stroke="#78685f" stroke-width="5"/>${windowLight}<path d="M28 117V68m0 16-12-9m12 24 14-11" stroke="#7a7475" stroke-width="3"/><g fill="#f1c4c4"><circle cx="20" cy="69" r="10"/><circle cx="36" cy="76" r="12"/><circle cx="18" cy="85" r="8"/></g>`,
  heath:`<path d="M7 110Q50 77 100 103t93-5v28H7z" fill="#669795"/><path d="M47 63h30v56H47zM122 58h30v61h-30zM76 79h48v40H76z" fill="#c8d0c7"/><path d="M43 63V50h9v8h8v-8h9v8h10v5m40-5V45h9v8h8v-8h9v8h9v5" fill="none" stroke="#c8d0c7" stroke-width="5"/>${windowLight}<path d="M37 121v-28m0 13-8-7m8 16 8-8m119 15v-24m0 10 8-8" stroke="#e7d59d" stroke-width="2.5"/><path d="M131 44V22l27 8-27 8" fill="#e5be8d" stroke="#e5be8d" stroke-width="2"/>`,
  grove:`<path d="M30 123V39m-7 10-9-8m16 29 15-12m124 65V36m0 21 12-12" stroke="#727b6c" stroke-width="9"/><g fill="#629e8d"><circle cx="31" cy="33" r="25"/><circle cx="13" cy="49" r="15"/><circle cx="163" cy="30" r="27"/><circle cx="179" cy="53" r="19"/></g><path d="M60 80h80v41H60z" fill="#b7c4a2"/><path d="M49 82q51-88 102 0Q100 70 49 82" fill="#45877d" stroke="#b1ceac" stroke-width="3"/>${windowLight}<g fill="#ffe6aa"><circle cx="43" cy="88" r="4"/><circle cx="156" cy="95" r="4"/><circle cx="72" cy="29" r="2"/></g>`,
};
const drawings={
  ...houses,
  katana:'<path d="M51 112Q135 66 159 21q-13 53-95 100Z" fill="#d9f3e7" stroke="#fff3cb" stroke-width="2"/><path d="m59 119-19 12-8-12 18-13Z" fill="#dfaaa5" stroke="#876c79" stroke-width="2"/><path d="m46 111 8 10m-14-6 8 10m2-23 19 22" stroke="#f9daa8" stroke-width="3"/><path d="m68 125 73-54" stroke="#365566" stroke-width="9"/><path d="m70 123 70-53" stroke="#82b9ac" stroke-width="2"/>',
  spear:'<path d="m57 128 69-92" stroke="#a0b4a2" stroke-width="8"/><path d="m57 128 69-92" stroke="#e8c99e" stroke-width="3"/><path d="m119 45 29-30-5 39-20 10Z" fill="#d5efe3" stroke="#fff0bf" stroke-width="2"/><path d="m120 57 19 12m-26-5 19 12" stroke="#e3b3a6" stroke-width="4"/><path d="m125 70q-24 7-21 24" fill="none" stroke="#e3b3a6" stroke-width="4"/>',
  staff:'<path d="m76 130 33-71q-21-6-14-26 6-21 26-15 22 7 9 28-7 10-14 4" fill="none" stroke="#bfc8a4" stroke-width="9"/><path d="m78 128 29-66" stroke="#f1d6a2" stroke-width="2"/><circle cx="113" cy="40" r="11" fill="#a4e8d2"/><circle cx="113" cy="40" r="5" fill="#fff5cf"/><path d="m102 78 24 1-24 13" fill="none" stroke="#e4c1d0" stroke-width="3"/>',
  guard:'<path d="M42 71q3-37 28-25l30 21 30-21q25-12 28 25-3 35-58 57-55-22-58-57Z" fill="#669e9a" stroke="#bce4d0" stroke-width="3"/><path d="M83 89q-3-22 17-28 20 6 17 28-3 15-17 20-14-5-17-20" fill="#ffdfb0"/><path d="M97 77h6m-3-3v6" stroke="#fff7dd" stroke-width="3"/>',
  seek:'<path d="M100 18 114 61 159 75 114 89 100 132 86 89 41 75 86 61Z" fill="#e2d4a7" stroke="#fff0cf" stroke-width="2"/><path d="M100 39v36h35L100 89Z" fill="#74a9a0"/><circle cx="100" cy="75" r="8" fill="#fff1c9"/>',
  discern:'<circle cx="100" cy="74" r="44" fill="#67979c" stroke="#bbded7" stroke-width="3"/><path d="M119 36q-37 24-14 66-43-4-42-36 3-27 30-33" fill="#eee6c2"/><path d="M47 127q52-13 105 0m-84 8h64" fill="none" stroke="#b0d7cd" stroke-width="2"/><circle cx="124" cy="71" r="3" fill="#ffedc0"/>',
};
export function memoryImage(kind){return wrap(`${pool}${stars}${drawings[kind]||drawings.discern}`);}
export function clanCrest(kind='petal'){
  const inner=kind==='wind'?'<path d="M58 80q32-48 70-26M57 98q35-45 86-20M78 112q22-30 48-21" fill="none"/>':kind==='leaf'?'<path d="M100 113q-44-24-25-60 27 5 25 48 0-44 28-54 16 37-28 66Z" fill="none"/>':'<path d="M100 105q-41-4-33-29 19-9 33 16-29-24-13-40 24-3 13 34 10-37 29-24 10 24-23 32 34-8 31 15-20 20-37-4Z" fill="none"/>';
  return wrap(`<g stroke="#e2d6aa" stroke-width="3"><circle cx="100" cy="80" r="47" fill="none"/>${inner}<circle cx="100" cy="96" r="3" fill="#e2d6aa"/></g>`);
}
export function familyMemory(culture){
  const home=houses[culture]||houses.wa;
  const people='<g stroke="#364e61" stroke-width="2"><path d="M76 133q-10-24 4-30 15 2 11 30" fill="#ceada9"/><circle cx="81" cy="96" r="8" fill="#edcfb5"/><path d="M109 133q-5-26 9-29 16 6 8 29" fill="#7e9fab"/><circle cx="119" cy="96" r="8" fill="#edcfb5"/><path d="M93 135q-3-19 7-19 10 0 7 19" fill="#d6d7b1"/><circle cx="100" cy="112" r="6" fill="#f4dcc2"/></g>';
  return wrap(`${pool}${stars}${home}${people}`);
}
