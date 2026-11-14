// Проверки: частицы, крепь, насос, день и ночь, «Журнал», заставка в окне новой игры.
// Запуск: node polish.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function makeEl() {
    return { _h: '', get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; if (v === '') this.children = []; }, textContent: '', value: '', checked: false, style: {}, children: [], dataset: {}, src: '',
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {},
        getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => (t[k] = v, true) }), width: 800, height: 600 };
}
function boot(store = {}) {
    const els = {}, notes = [];
    const body = Object.assign(makeEl(), { appendChild(n) { notes.push(n.textContent); } });
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem() {} },
        window: { addEventListener() {} }, requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => true,
        console, Date, Math: Object.create(Math), JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise, Uint8Array, encodeURIComponent
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), notes, body, store };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }
const room = `(() => { creatures = []; resetHazards(); gameState.paused = false; keys = {}; const F = DEPTH_ORIGIN + 250;
    for (let y = F - 8; y <= F + 3; y++) for (let x = 40; x <= 80; x++) world[y][x] = (y >= F - 4 && y <= F) ? BLOCK_TYPES.AIR : BLOCK_TYPES.STONE;
    player.x = 60; player.y = F; player.vy = 0; fallTop = null; })()`;
let g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(5);" + room);

console.log('Частицы');
g.run('particles = []; world[DEPTH_ORIGIN + 250][61] = BLOCK_TYPES.GOLD; player.direction = 1; breakBlock(61, DEPTH_ORIGIN + 250);');
check('выкопал руду — осколки и искры', g.run('particles.length') >= 8);
g.run('for (let i = 0; i < 120; i++) updateParticles(1/60);');
check('через пару секунд исчезают', g.run('particles.length') === 0);
g.run('for (let i = 0; i < 100; i++) spawnParticles(50, 50, "#fff", 20);');
check('не больше 260 разом — игра не тормозит', g.run('particles.length') <= 260);
g.run("particles = []; setTouchPad('perf', 'fast'); spawnParticles(50, 50, '#fff', 9);");
check('в режиме «Быстро» частиц втрое меньше', g.run('particles.length') === 3);
g.run("setTouchPad('perf', 'quality'); particles = [];");

console.log('Крепь');
check('без крепи — подсказка', g.run('placeSupport()') === false && g.notes.some(n => n.includes('Крепи нет')));
g.run('stats.money = 100; buySupports();');
check('в лавке: 5 штук за 25 монет', g.run('supports') === 5 && g.run('stats.money') === 75);
g.run('placeSupport();');
const F = g.run('DEPTH_ORIGIN + 250');
check('X — крепь стоит под ногами, сквозь неё ходят', g.run(`getBlock(60, ${F})`) === g.run('BLOCK_TYPES.SUPPORT') && g.run('supports') === 4 && !g.run(`isBlocked(60.5, ${F}.5)`));
g.run(`hazardRandom = () => 0; crumbling.length = 0; maybeCrumble(60, ${F} - 5); maybeCrumble(61, ${F} - 5);`);
check('потолок над крепью и рядом — не трескается', g.run('crumbling.length') === 0);
g.run(`maybeCrumble(70, ${F} - 5);`);
check('в стороне без крепи — трескается', g.run('crumbling.length') === 1);
g.run(`breakBlock(60, ${F});`);
check('выкопал крепь — вернулась', g.run('supports') === 5 && g.run(`getBlock(60, ${F})`) === 0);
g.run('player.y = SURFACE_Y - 1;');
check('на поверхности не ставится', g.run('placeSupport()') === false);

console.log('Насос');
g.run(room + `; (() => { const F = DEPTH_ORIGIN + 250; for (let y = F - 2; y <= F; y++) for (let x = 62; x <= 70; x++) world[y][x] = BLOCK_TYPES.WATER; })(); hasPump = false; ach.got = {};`);
check('без насоса — подсказка', g.run('pumpWater()') === false && g.notes.some(n => n.includes('Насоса нет')));
g.run('stats.money = 200; buyPump();');
check('насос — 180 монет, покупается один раз', g.run('hasPump') === true && g.run('stats.money') === 20 && g.run('buyPump()') === false);
g.run('player.x = 61; pumpWater();');
check('Z у воды — озеро откачано целиком', g.run('world.reduce((n, r, y) => n + (Math.abs(y - (DEPTH_ORIGIN + 250)) < 4 ? r.filter(b => b === BLOCK_TYPES.WATER).length : 0), 0)') === 0 && g.notes.some(n => n.includes('Откачано воды: 27')));
check('«Осушитель»', g.run('ach.got.pumper') !== undefined);
check('воды рядом нет — сообщение', g.run('pumpWater()') === false);

console.log('День и ночь');
g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(5);");
check('игра начинается утром, небо голубое', !g.run('isNight()') && g.run('skyColor()') === '#87CEEB');
g.run('dayTime = 520; ');
check('закат — небо краснеет', g.run('skyColor()') !== '#87CEEB');
g.run('dayTime = 600;');
check('ночь: небо тёмное', g.run('isNight()') && g.run('skyColor()') === '#0b1026');
g.run('player.x = SHOP_X + 1; player.y = SURFACE_Y - 1; openShop();');
check('ночью лавка не открывается — скупщик спит', !g.el('shopModal').classList.contains('active') && g.notes.some(n => n.includes('Скупщик спит')));
g.run('stats.money = 0; for (let i = 0; i < 5; i++) addToBackpack(BLOCK_TYPES.GOLD); checkShop();');
check('но руду принимает и ночью — по обычной цене', g.run('stats.money') === 40);
g.run('dayTime = 719; updateDay(2);');
check('рассвет — снова день', !g.run('isNight()') && g.run('morningBonus') === true && g.notes.some(n => n.includes('Рассвет')));
g.run('stats.money = 0; for (let i = 0; i < 5; i++) addToBackpack(BLOCK_TYPES.GOLD); checkShop();');
check('первая продажа утром — на 15 % дороже (40 + 6)', g.run('stats.money') === 46 && g.run('morningBonus') === false);
g.run('stats.money = 0; for (let i = 0; i < 5; i++) addToBackpack(BLOCK_TYPES.GOLD); checkShop();');
check('вторая — по обычной', g.run('stats.money') === 40);
const save = JSON.parse(g.run('dayTime = 333; JSON.stringify(createSaveData("t"))'));
g.run(`dayTime = 0; loadSaveData(${JSON.stringify(save)})`);
check('время суток, крепь и насос — в сохранении', g.run('dayTime') === 333 && 'supports' in save && 'pump' in save);
g.run("setSound('daynight', false); dayTime = 600;");
check('выключил в настройках — всегда день', !g.run('isNight()') && g.run('skyColor()') === '#87CEEB');

console.log('Журнал и заставка');
check('достижения, рекорды, статистика и дневник — под кнопкой «📒 Журнал»', /id="moreToggle" onclick="toggleMore\(\)">📒 Журнал[\s\S]*?<div id="moreButtons">[\s\S]*?openAchievements[\s\S]*?openRecords[\s\S]*?openStats[\s\S]*?openDiary/.test(html));
check('нажал — раскрылось, ещё раз — свернулось', g.run('toggleMore()') === true && g.body.classList.contains('show-more') && g.run('toggleMore()') === false);
check('на телефоне в меню ☰ журнал всегда раскрыт', /body\.touch\.menu-open #moreButtons \{ display: grid; \}/.test(html));
g.run('openModePicker()');
check('в окне новой игры — заставка: шахтёр, название и версия', g.el('titleSprite').src.startsWith('data:image/svg+xml') && g.el('titleName').textContent === 'Шахтёр 1899' && g.el('titleSub').textContent.includes('v' + g.run('GAME_VERSION')));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
