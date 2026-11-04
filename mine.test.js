// Проверки «нового в шахте»: озёра (плавание, воздух, в хардкоре можно утонуть), вагонетки,
// сундуки и старая карта, самородки, генерация от зерна мира.
// Запуск: node mine.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function makeEl() {
    return { textContent: '', innerHTML: '', value: '', checked: false, style: {}, children: [], dataset: {},
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {},
        getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => (t[k] = v, true) }), width: 800, height: 600 };
}
const notes = [], handlers = {};
const sb = {
    document: { getElementById: (() => { const e = {}; return id => e[id] || (e[id] = makeEl()); })(), createElement: () => makeEl(), body: { appendChild(n) { notes.push(n.textContent); }, classList: makeEl().classList }, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, window: { addEventListener(t, f) { handlers[t] = f; } },
    requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => false,
    console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise
};
vm.createContext(sb); vm.runInContext(script, sb);
const run = c => vm.runInContext(c, sb);
const press = (code, down = true) => (down ? handlers.keydown : handlers.keyup)({ code, preventDefault() {} });
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }
const count = t => run(`world.reduce((n, r) => n + r.filter(b => b === BLOCK_TYPES.${t}).length, 0)`);

console.log('Генерация');
run('generateWorld(2024);');
check(`озёра: ${count('WATER')} клеток воды`, count('WATER') >= 30);
check(`старые штольни: рельсы ${count('RAIL')}, вагонеток ${count('CART')}`, count('RAIL') > 60 && count('CART') >= 3);
check(`сундуки: ${count('CHEST')}`, count('CHEST') >= 5);
check(`самородки: ${count('NUGGET')}`, count('NUGGET') >= 3);
const w1 = run('JSON.stringify(compressWorld())'); run('generateWorld(2024);');
check('одно зерно — те же озёра, сундуки и рельсы (важно для «Шахты дня»)', run('JSON.stringify(compressWorld())') === w1);
check('вода не выше 200 м', run('world.every((r, y) => y - DEPTH_ORIGIN >= 200 || !r.includes(BLOCK_TYPES.WATER))'));
check('сквозь воду, рельсы и вагонетку можно пройти, сундук — твёрдый', !run("(() => { for (const t of ['WATER','RAIL','CART']) { world[300][5] = BLOCK_TYPES[t]; if (isBlocked(5.5, 300.5)) return true; } return false; })()") && (() => { run('world[300][5] = BLOCK_TYPES.CHEST'); return run('isBlocked(5.5, 300.5)'); })());

// площадка для опытов
const pool = (setup) => run(`(() => { chooseMode(false); chooseGoal('free'); creatures = []; resetHazards(); gameState.paused = false; keys = {}; debug.on = false;
    ach.got = {}; const F = DEPTH_ORIGIN + 300;
    for (let y = F - 10; y <= F + 2; y++) for (let x = 30; x <= 90; x++) world[y][x] = (y <= F && y >= F - 9) ? BLOCK_TYPES.AIR : BLOCK_TYPES.STONE;
    player.x = 60; player.y = F; player.vx = 0; player.vy = 0; fallTop = null; cartRide = null; breath = BREATH_MAX; lampTier = 0; ${setup} })()`);

console.log('Озёра');
pool(`for (let y = F - 6; y <= F; y++) for (let x = 40; x <= 80; x++) world[y][x] = BLOCK_TYPES.WATER; player.y = F - 6; player.vy = 0;`);
run('for (let i = 0; i < 60; i++) updatePlayer(1/60);');
check('в воде тонет медленно (не падает камнем)', run('player.vy') <= 2.5 + 1e-9 && run('player.y') < run('DEPTH_ORIGIN + 300'));
run('player.y = DEPTH_ORIGIN + 298; player.vy = 0; keys = { KeyW: true }; for (let i = 0; i < 20; i++) updatePlayer(1/60); keys = {};');
check('W — всплывает', run('player.vy') < 0);
run('player.x = 50; player.y = DEPTH_ORIGIN + 298; keys = { KeyD: true }; updatePlayer(0.1); keys = {};');
check('плывёт медленнее, чем идёт', run('player.vx') < run('MOVE_SPEED') * 0.6);
run('player.y = DEPTH_ORIGIN + 299; lampTier = 1; lampLit = true; updateWater(0.1);');
check('открытая лампа под водой гаснет', run('lampLit') === false);
const h0 = run('health = maxHealth()');
run('for (let i = 0; i < 12 * 30; i++) updateWater(1/30);');
check('обычная игра: под водой 12 секунд — не тонет', run('health') === h0);
check('«Ныряльщик» — 5 секунд под водой', run('ach.got.diver') !== undefined);
run("Object.assign(mode, { hardcore: true, variant: 'harsh' }); breath = BREATH_MAX; health = maxHealth(); for (let i = 0; i < 6 * 30; i++) updateWater(1/30);");
check('хардкор: воздух уходит, пока ещё не ранит', run('breath') < 3 && run('health') === run('maxHealth()') && notes.some(n => n.includes('Воздух кончается')));
run('for (let i = 0; i < 4 * 30; i++) updateWater(1/30);');
check('хардкор: воздух кончился — тонет', run('health') < run('maxHealth()'));
run('player.y = DEPTH_ORIGIN + 291; for (let i = 0; i < 30; i++) updateWater(1/30);');
check('вынырнул — воздух возвращается', run('breath') > 0.5);
run("Object.assign(mode, { hardcore: false });");

console.log('Вагонетка');
pool(`for (let x = 40; x <= 70; x++) world[F][x] = BLOCK_TYPES.RAIL; for (let x = 40; x <= 70; x++) world[F + 1][x] = BLOCK_TYPES.STONE; world[F][45] = BLOCK_TYPES.CART;
      player.x = 45.05; player.y = F; player.direction = 1;`);
press('KeyE'); press('KeyE', false);
check('E у вагонетки — сел', run('cartRide !== null') && run('getBlock(45, DEPTH_ORIGIN + 300)') === run('BLOCK_TYPES.RAIL'));
run('for (let i = 0; i < 60; i++) updatePlayer(1/60);');
check('едет по рельсам быстро', run('player.x') > 52);
const save = JSON.parse(run('JSON.stringify(createSaveData("t"))'));
check('сохранение на ходу — вагонетка не теряется', save.world.data !== undefined && run('getBlock(Math.round(cartRide.x), DEPTH_ORIGIN + 300)') === run('BLOCK_TYPES.RAIL'));
run('for (let i = 0; i < 240; i++) updatePlayer(1/60);');
check('рельсы кончились — остановился и сошёл, вагонетка стоит в конце', run('cartRide') === null && run('getBlock(70, DEPTH_ORIGIN + 300)') === run('BLOCK_TYPES.CART'));
check('«Машинист» — 20 блоков', run('ach.got.machinist') !== undefined);
run('player.x = 69.05; player.direction = -1; mountCart(); for (let i = 0; i < 20; i++) updatePlayer(1/60); keys = { KeyS: true }; updatePlayer(1/60); keys = {};');
check('S — сойти на ходу', run('cartRide') === null && run('world[DEPTH_ORIGIN + 300].filter(b => b === BLOCK_TYPES.CART).length') === 1);

console.log('Сундук и карта');
pool('world[F][62] = BLOCK_TYPES.CHEST; player.direction = 1; stats.money = 0;');
run('breakBlock(62, DEPTH_ORIGIN + 300);');
check('раскопал сундук — монеты и находки', run('stats.money') >= 30 && notes.some(n => n.includes('Сундук старого шахтёра')) && run('getBlock(62, DEPTH_ORIGIN + 300)') === 0);
check('«Кладоискатель»', run('ach.got.treasure') !== undefined);
run('mapUntil = stats.playtime + 90;');
check('старая карта подсвечивает руду рядом', run('mapRevealed(Math.floor(player.x) + 3, Math.floor(player.y), BLOCK_TYPES.GOLD)') === true && run('mapRevealed(Math.floor(player.x) + 3, Math.floor(player.y), BLOCK_TYPES.STONE)') === false);
run('mapUntil = 0;');
check('карта кончилась — нет', run('mapRevealed(Math.floor(player.x) + 3, Math.floor(player.y), BLOCK_TYPES.GOLD)') === false);

console.log('Самородок');
check('самородок — руда: 90 монет, вес 3', run('ORES[BLOCK_TYPES.NUGGET].price') === 90 && run('ORES[BLOCK_TYPES.NUGGET].weight') === 3);
pool('world[F][61] = BLOCK_TYPES.NUGGET; player.direction = 1; backpack = emptyBackpack();');
run('breakBlock(61, DEPTH_ORIGIN + 300);');
check('добыл — в рюкзаке, «Золотая лихорадка»', run('backpack.nugget') === 1 && run('ach.got.goldrush') !== undefined && run('backpackValue()') === 90);
check('в легенде — вода и самородок', />Вода</.test(html) && />Самородок</.test(html));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
