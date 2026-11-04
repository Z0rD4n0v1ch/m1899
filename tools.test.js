// Проверки: мини-карта и карта шахты, динамит, шахта по коду, статистика за всё время.
// Запуск: node tools.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function makeEl() {
    return { _h: '', get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, textContent: '', value: '', checked: false, style: {}, children: [], dataset: {}, scrollTop: 0,
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {},
        getContext: () => new Proxy({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => (t[k] = v, true) }), width: 800, height: 600 };
}
function boot(store = {}) {
    const els = {}, notes = [], handlers = {};
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body: { appendChild(n) { notes.push(n.textContent); }, classList: makeEl().classList }, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        window: { addEventListener(t, f) { handlers[t] = f; } }, requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => true,
        console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise, Uint8Array, Uint8ClampedArray
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), notes, handlers, store };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }
const room = `(() => { creatures = []; resetHazards(); gameState.paused = false; keys = {}; const F = DEPTH_ORIGIN + 300;
    for (let y = F - 8; y <= F + 3; y++) for (let x = 40; x <= 80; x++) world[y][x] = (y >= F - 5 && y <= F) ? BLOCK_TYPES.AIR : BLOCK_TYPES.STONE;
    player.x = 60; player.y = F; player.vy = 0; fallTop = null; })()`;

console.log('Мини-карта');
let g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(5);" + room);
check('сначала ничего не разведано', g.run('seen.reduce((a, b) => a + b, 0)') === 0);
g.run('markSeen();');
const n1 = g.run('seen.reduce((a, b) => a + b, 0)');
check(`шаг — разведан круг вокруг (${n1} клеток)`, n1 > 100 && n1 < 160);
g.run('player.x = 70; markSeen();');
check('пошёл дальше — карта растёт', g.run('seen.reduce((a, b) => a + b, 0)') > n1);
const save = JSON.parse(g.run('JSON.stringify(createSaveData("t"))'));
g.run('seenFromRuns(null);'); g.run(`loadSaveData(${JSON.stringify(save)})`);
check('разведанное сохраняется и загружается', g.run('seen.reduce((a, b) => a + b, 0)') > n1);
g.run('openBigMap()');
check('N / кнопка — карта всей шахты с процентом разведки', g.el('mapModal').classList.contains('active') && g.el('bigMapInfo').textContent.includes('Разведано'));
g.run('closeBigMap()');
check('кнопка «🗺 Карта» и настройка «Мини-карта»', /openBigMap\(\)">🗺 Карта/.test(html) && /id="optMinimap"/.test(html));

console.log('Динамит');
g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(5);" + room);
check('без динамита — подсказка', g.run('lightDynamite()') === false && g.notes.some(n => n.includes('Динамита нет')));
g.run('stats.money = 100; buyDynamite(); buyDynamite();');
check('в лавке: 40 монет за шашку', g.run('dynamite') === 2 && g.run('stats.money') === 20);
g.run(`const F = DEPTH_ORIGIN + 300; for (let x = 61; x <= 62; x++) for (let y = F - 1; y <= F + 1; y++) world[y][x] = BLOCK_TYPES.STONE;
       world[F][61] = BLOCK_TYPES.GOLD; backpack = emptyBackpack(); health = maxHealth();
       creatures.push(makeCreature('rat', 61, F - 1));`);
g.run('lightDynamite();');
check('поджёг — фитиль 2.5 с', g.run('fuses.length') === 1 && g.run('dynamite') === 1 && g.notes.some(n => n.includes('Фитиль горит')));
g.run('player.x = 54; updateDynamite(1); ');
check('через секунду ещё не взорвалось', g.run('fuses.length') === 1);
g.run('updateDynamite(2);');
check('взрыв: камень вокруг выбит', g.run('getBlock(61, DEPTH_ORIGIN + 300)') === 0 && g.run('getBlock(61, DEPTH_ORIGIN + 299)') === 0);
check('руда в зоне взрыва — в рюкзак или разлетелась', g.notes.some(n => n.includes('Бум!')));
check('тварь рядом погибла', g.run('creatures[0].hp') <= 0);
check('отошёл на 6 блоков — не ранен', g.run('health') === g.run('maxHealth()'));
check('«Подрывник»', g.run('ach.got.blaster') !== undefined);
g.run('player.x = 60; health = maxHealth(); lightDynamite(); updateDynamite(3);');
check('стоял рядом — ранило', g.run('health') < g.run('maxHealth()'));
g.run('player.y = SURFACE_Y - 1; dynamite = 3;');
check('на поверхности — нельзя', g.run('lightDynamite()') === false);
g.run('dynamite = 10; stats.money = 999;');
check('больше 10 шашек не унести', g.run('buyDynamite()') === false);
check('клавиша B', /e\.code === 'KeyB' && !gameState\.paused\) lightDynamite\(\)/.test(html));

console.log('Шахта по коду');
g = boot();
g.run('generateWorld(123456789);');
const code = g.run('worldCode()');
check(`код шахты: ${code}`, /^M1899-[0-9A-Z]+$/.test(code) && g.run(`seedFromCode('${code}')`) === 123456789);
check('код можно вводить без «M1899-» и маленькими буквами', g.run(`seedFromCode('${code.slice(6).toLowerCase()}')`) === 123456789);
check('ерунда — нет', g.run("seedFromCode('привет')") === null && g.run("seedFromCode('')") === null);
const world1 = g.run('JSON.stringify(compressWorld())');
const g2 = boot();
g2.el('worldCodeInput').value = code;
g2.run('playByCode()');
check('друг ввёл код — та же шахта, дальше выбор цели', g2.run('JSON.stringify(compressWorld())') === world1 && g2.el('goalModal').classList.contains('active'));
check('в окне новой игры — поле кода и кнопка', /id="worldCodeInput"[\s\S]*?playByCode\(\)/.test(html));

console.log('Статистика за всё время');
const store = {};
g = boot(store);
g.run("chooseMode(false); chooseGoal('free'); generateWorld(5);" + room);
g.run('const F = DEPTH_ORIGIN + 300; world[F][61] = BLOCK_TYPES.STONE; player.direction = 1; breakBlock(61, F); world[F][61] = BLOCK_TYPES.GOLD; breakBlock(61, F);');
check('выкопано и добыто считаются', g.run('life.dug') >= 1 && g.run('life.ore') === 1);
g.run("creatures.push(makeCreature('rat', 50, 100)); killCreature(creatures[creatures.length - 1]); die('тест');");
check('твари и смерти', g.run('life.kills') === 1 && g.run('life.deaths') === 1);
g.run('lifeTick(12);');
check('копится время и сохраняется в браузере', JSON.parse(store.miner_lifetime).playtime >= 12);
g.run('newGame(true);');
check('новая игра — счётчик игр, статистика не обнуляется', g.run('life.games') === 1 && g.run('life.ore') === 1);
g.run('openStats()');
const st = g.el('statsInfo').innerHTML;
check('окно: код шахты, игры, время, выкопано, руда, смерти, любимая кирка', ['Код этой шахты', 'M1899-', 'Игр', 'Выкопано блоков', 'Добыто руды', 'Смертей', 'Любимая кирка'].every(t => st.includes(t)));
check('после перезапуска — та же', boot(store).run('life.games') === 1);
const gd = boot(); gd.run("chooseMode(false); chooseGoal('free'); run.debugUsed = true; lifeTick(5); die('x');");
check('игра с отладкой в статистику не идёт', gd.run('life.playtime') === 0 && gd.run('life.deaths') === 0);

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
