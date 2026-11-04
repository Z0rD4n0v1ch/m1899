// Проверки текстур блоков и обводки спрайтов.
// Запуск: node gfx.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const draws = [];
const ctxFor = () => new Proxy({}, { get: (t, k) => k === 'drawImage' ? (...a) => draws.push(a) : (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => (t[k] = v, true) });
function makeEl() {
    return { textContent: '', innerHTML: '', value: '', checked: false, style: {}, children: [], dataset: {},
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {}, getContext: () => ctxFor(), width: 800, height: 600 };
}
const store = {};
const sb = {
    document: { getElementById: (() => { const e = {}; return id => e[id] || (e[id] = makeEl()); })(), createElement: () => makeEl(), body: { appendChild() {}, classList: makeEl().classList }, querySelectorAll: () => [] },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem() {} }, window: { addEventListener() {} },
    requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => false, console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise, Uint8Array
};
vm.createContext(sb); vm.runInContext(script, sb);
const run = c => vm.runInContext(c, sb);
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }

console.log('Текстуры блоков');
run('generateWorld(3);');
check('у камня, песка, глины, гравия, земли, руды и лавы — текстура', ['STONE', 'SAND', 'CLAY', 'GRAVEL', 'DIRT', 'GOLD', 'DIAMOND', 'LAVA', 'BEDROCK'].every(b => run(`blockTexture(BLOCK_TYPES.${b}, 10, DEPTH_ORIGIN + 100) !== null`)));
check('у воздуха, лестницы и воды — нет', ['AIR', 'LADDER', 'WATER'].every(b => run(`blockTexture(BLOCK_TYPES.${b}, 10, 100)`) === null));
run('for (const k in TEX) delete TEX[k];');
for (let x = 0; x < 40; x++) run(`blockTexture(BLOCK_TYPES.STONE, ${x}, DEPTH_ORIGIN + 100)`);
check('у одного блока в одном пласте — 4 варианта (не повторяется клеткой)', run('Object.keys(TEX).length') === 4);
run('blockTexture(BLOCK_TYPES.STONE, 0, DEPTH_ORIGIN + 300)');
check('в другом пласте — своя текстура (цвет породы пласта)', run('Object.keys(TEX).length') === 5);
run('setZoom(36); blockTexture(BLOCK_TYPES.STONE, 0, DEPTH_ORIGIN + 300)');
check('другой масштаб — текстура под новый размер', run("Object.keys(TEX).some(k => k.endsWith('|36'))"));
run('setZoom(28); player.x = 60; player.y = DEPTH_ORIGIN + 100; updateCamera();');
draws.length = 0; run('render()');
check('на экране блоки рисуются текстурами', draws.length > 300);
run("setSound('textures', false)");
draws.length = 0; run('render()');
check('выключил «Текстуры блоков» — ровные клетки', draws.length < 100 && run('blockTexture(BLOCK_TYPES.STONE, 0, 0)') === null);
run("setSound('textures', true)");
check('в настройках', /id="optTextures"/.test(html));

console.log('Спрайты');
const svgs = run('Object.entries(SPRITES).filter(([k]) => (!k.startsWith("tile.") || ["tile.cart","tile.chest","tile.nugget"].includes(k)) && k !== "fire" && k !== "shop").flatMap(([, v]) => v)');
check(`у шахтёра, тварей, Хозяина, канарейки, вагонетки, сундука, самородка — тёмный контур (${svgs.length} кадров)`, svgs.every(s => s.includes('filter="url(#o)"')));
check('у шахтёра — тень на рубахе, ремень с пряжкой, пуговицы', run("SPRITES['miner.idle'][0]").includes('url(#sh)') && run("SPRITES['miner.idle'][0]").includes('#c8a165'));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
