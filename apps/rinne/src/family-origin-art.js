// Authored vector memories, bundled with the app. No remote imagery or font dependency.
const svg = (body, box = '0 0 240 150') => `<svg viewBox="${box}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
export function familyCrestArt(culture) {
  const mark = culture === 'wa' ? '<path d="m19 43 13-22 9 14 9-20 15 28Z"/>' : culture === 'forest' ? '<path d="M40 54V34C17 37 17 17 17 17s26-2 23 22c-2-26 24-23 24-23s0 23-24 23"/>' : '<path d="M21 41c0-24 35-26 38-5 3 17-22 24-27 9-3-10 12-16 15-6"/>';
  return svg(`<g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="40" r="34"/><circle cx="40" cy="40" r="29" opacity=".4"/>${mark}</g>`, '0 0 80 80');
}
export function familyHomeArt(culture, people = true) {
  const japanese = culture === 'wa', forest = culture === 'forest';
  const far = forest ? '<path d="M0 182 47 45l46 134L152 19l60 168L264 54l49 128L370 20l59 165L497 37l59 147L608 26l32 153Z" fill="#1f555a"/>' : '<path d="M0 178 127 44l111 108L362 20l155 152L617 60l23 116Z" fill="#355f69"/><path d="m276 91 86-71 79 79-72-27-30 19-21-13Z" fill="#96bdba" opacity=".3"/>';
  const home = japanese
    ? '<path d="M172 167h288v111H172Z" fill="#674f47"/><path d="M187 182h256v79H187Z" fill="#c2a16b"/><path d="m141 181 49-21 107-69h41l109 68 49 22-17 13H160Z" fill="#183d47"/><path d="m160 179 151-78 160 79M154 188h333" fill="none" stroke="#719087" stroke-width="5"/><path d="M193 207h244M215 182v81m42-81v81m42-81v81m42-81v81m42-81v81m42-81v81" stroke="#6e6250" stroke-width="5"/><path d="M164 271h305v13H164Z" fill="#30484a"/><path d="M301 195h33v73h-33Z" fill="#eaca83"/>'
    : forest
      ? '<path d="M190 181h258v95H190Z" fill="#625846"/><path d="m165 192 142-105 161 105Z" fill="#36635c"/><path d="m165 183 142-108 162 109" fill="none" stroke="#779882" stroke-width="12"/><path d="M300 202h43v74h-43Zm-83 6h45v36h-45Zm164 0h43v36h-43Z" fill="#e1bd73"/><path d="M40 53v235m15-187-36 84m544-113v218m-7-175 35 44" stroke="#274a48" stroke-width="19"/>'
      : '<path d="M163 144h61v137h-61Zm259 0h61v137h-61ZM219 188h208v93H219Z" fill="#6a8180"/><path d="m151 150 44-66 43 66Zm259 0 42-66 43 66Z" fill="#31525d"/><path d="M299 281v-58a24 24 0 0 1 48 0v58Z" fill="#e5c17a"/><path d="M173 171h16v25h-16Zm272 0h16v25h-16Z" fill="#e5c17a"/><path d="M228 194h195" stroke="#acb19a" stroke-width="9"/>';
  const family = people ? '<g fill="#21343c"><circle cx="357" cy="246" r="9"/><path d="m349 254-5 31h27l-7-31Z"/><circle cx="398" cy="245" r="10"/><path d="m389 254-6 31h29l-6-31Z"/><circle cx="377" cy="263" r="7"/><path d="m371 269-4 17h21l-4-17Z"/></g>' : '';
  return svg(`<path fill="#173d50" d="M0 0h640v320H0Z"/><circle cx="468" cy="54" r="31" fill="#b7d1c1" opacity=".65"/>${far}<path d="M0 205Q123 131 296 186t344-12v146H0Z" fill="#315c60"/><path d="M0 249Q180 210 341 251t299-23v92H0Z" fill="#24494e"/>${home}<ellipse cx="322" cy="293" rx="147" ry="9" fill="#8ea899" opacity=".18"/>${family}<path d="M0 293q54-12 101 2m408-4q55-16 131-4" stroke="#6e9290" stroke-width="4" fill="none"/><g fill="#e9cb89"><circle cx="109" cy="226" r="2"/><circle cx="525" cy="211" r="2"/><circle cx="504" cy="253" r="1.5"/></g>`, '0 0 640 320');
}
export function familyMemoryArt(id) {
  if (['wa', 'plains', 'forest'].includes(id)) return familyHomeArt(id, false);
  if (['guard', 'seek', 'discern'].includes(id)) {
    const art = id === 'guard' ? '<path d="M83 34q37 16 74 0v45q0 31-37 46-37-15-37-46Z"/><path d="M120 52v50m-20-27h40"/>' : id === 'seek' ? '<circle cx="120" cy="74" r="45"/><path d="m139 44-9 39-28 24 7-39Z"/><path d="M120 18v10m0 93v11m-58-58h11m95 0h11"/>' : '<path d="M61 76q59-61 118 0-59 61-118 0Z"/><circle cx="120" cy="76" r="19"/><path d="m91 35-5-13m63 13 5-13m-34 7V15"/>';
    return svg(`<g fill="none" stroke="#c9dcd2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${art}</g>`);
  }
  const art = id === 'katana' ? '<path d="M88 104q52-24 91-84-18 62-83 94Z" fill="#d5e5df"/><path d="m72 125 20-23m-9-7 18 18" stroke="#d5ac62" stroke-width="7"/><path d="m69 130 15-17" stroke="#977462" stroke-width="10"/>' : id === 'spear' ? '<path d="m75 129 83-89" stroke="#b19a79" stroke-width="8"/><path d="m138 48 43-29-17 48Z" fill="#d5e5df"/><path d="m145 58 17 13" stroke="#c9a564" stroke-width="5"/>' : '<path d="M114 131q-8-28 9-64c18-36-25-43-26-17-1 17 24 20 24 4" stroke="#b8a57e" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M123 61q38-10 29-34-27 3-29 34Z" fill="#81b5a0"/>';
  return svg(`<circle cx="120" cy="75" r="61" fill="#bfdad2" opacity=".035"/>${art}`);
}
