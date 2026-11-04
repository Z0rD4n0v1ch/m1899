// Проверки: дневник старого шахтёра и Хозяин дна.
// Запуск: node story.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function makeEl() {
    return { _h: '', get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, textContent: '', value: '', checked: false, style: {}, children: [], dataset: {},
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {},
        getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => (t[k] = v, true) }), width: 800, height: 600 };
}
function boot(store = {}) {
    const els = {}, notes = [];
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body: { appendChild(n) { notes.push(n.textContent); }, classList: makeEl().classList }, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        window: { addEventListener() {} }, requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => true,
        console, Date, Math: Object.create(Math), JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise, Uint8Array
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), notes, store };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }

console.log('Дневник');
const store = {};
let g = boot(store);
g.run("chooseMode(false); chooseGoal('free'); generateWorld(9);");
check('10 страниц истории', g.run('DIARY.length') === 10 && g.run('diary.length') === 0);
g.run('Math.random = () => 0.1; const F = DEPTH_ORIGIN + 300; world[F][61] = BLOCK_TYPES.CHEST; openChest(61, F);');
check('в сундуке — первая страница', g.run('diary.join()') === '0' && g.notes.some(n => n.includes('Страница дневника 1 из 10')));
for (let i = 0; i < 12; i++) g.run('world[DEPTH_ORIGIN + 300][61] = BLOCK_TYPES.CHEST; openChest(61, DEPTH_ORIGIN + 300);');
check('сундуки дают страницы 1–9 по порядку, последнюю — нет', g.run('diary.length') === 9 && !g.run('diary.includes(9)'));
g.run('Math.random = () => 0.9; diary.pop(); world[DEPTH_ORIGIN + 300][61] = BLOCK_TYPES.CHEST; openChest(61, DEPTH_ORIGIN + 300);');
check('страница выпадает не всегда (60 %)', g.run('diary.length') === 8);
check('страницы хранятся в браузере — для всех игр', boot(store).run('diary.length') === 9);
g.run('openDiary()');
const box = g.el('diaryInfo').innerHTML;
check('окно: найденные — с текстом, остальные — «ещё не найдена», последняя — «у самого дна»', box.includes('3 марта 1899') && box.includes('страница ещё не найдена') && box.includes('у самого дна'));
g.run('closeDiary()');

console.log('Хозяин дна');
g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(9); Math.random = () => 0.5;");
check('у подошвы шахты — зал Хозяина', g.run('bossHome !== null') && g.run('bossHome.y - DEPTH_ORIGIN') >= 760);
check('стены зала — платиновая жила', g.run('(() => { let n = 0; for (let y = bossHome.y - 4; y <= bossHome.y; y++) for (let x = bossHome.x - 11; x <= bossHome.x + 7; x++) if (getBlock(x, y) === BLOCK_TYPES.PLATINUM) n++; return n; })()') >= 4);
check('Хозяин в зале и спит', g.run('boss !== null && !boss.awake && boss.hp === BOSS.hp'));
g.run('player.x = bossHome.x - 30; player.y = bossHome.y; updateBoss(0.1);');
check('далеко — спит', !g.run('boss.awake'));
g.run('player.x = bossHome.x - 6; player.y = bossHome.y; fallTop = null; updateBoss(0.1);');
check('подошёл — проснулся', g.run('boss.awake') && g.notes.some(n => n.includes('Хозяин дна проснулся')));
const bx0 = g.run('boss.x');
g.run('fireballs.length = 0; boss.spit = 0.05; updateBoss(0.1);');
check('ползёт к игроку и плюётся пламенем', g.run('boss.x') < bx0 && g.run('fireballs.length') === 1);
g.run('health = maxHealth(); player.x = boss.x + 0.5; player.y = boss.y + 1; boss.bite = 0; updateBoss(0.01);');
check('касание обжигает', g.run('health') === g.run('maxHealth() - BOSS.touch'));
g.run('player.x = boss.x - 1.2; player.y = boss.y + 1; player.direction = 1; pickaxeTier = 3; hitCooldown = 0;');
check('удар киркой — ранит', g.run('tryAttack()') === true && g.run('boss.hp') < g.run('BOSS.hp'));
g.run('stats.money = 0; backpack = emptyBackpack(); backpackTier = 2; Math.random = () => 0.99; for (let i = 0; i < 40 && boss.hp > 0; i++) { hitCooldown = 0; tryAttack(); }');
check('повержен: монеты, платина ×5, последняя страница, достижение', g.run('boss.hp') <= 0 && g.run('stats.money') >= 400 && g.run('backpack.platinum') === 5 && g.run('diary.includes(9)') && g.run('ach.got.bossSlayer') !== undefined);
const save = JSON.parse(g.run('JSON.stringify(createSaveData("t"))'));
check('победа и зал — в сохранении', save.run.bossDefeated === true && save.bossHome && save.bossHome.y === g.run('bossHome.y'));
g.run(`loadSaveData(${JSON.stringify(save)})`);
check('после загрузки побеждённый не оживает', g.run('boss') === null);
const fresh = Object.assign({}, save, { run: Object.assign({}, save.run, { bossDefeated: false }) });
g.run(`loadSaveData(${JSON.stringify(fresh)})`);
check('не побеждён — снова ждёт в зале', g.run('boss !== null && boss.hp === BOSS.hp'));
const old = Object.assign({}, save); delete old.bossHome;
g.run(`loadSaveData(${JSON.stringify(old)})`);
check('старое сохранение без зала — без Хозяина, без ошибок', g.run('boss') === null);
check('«Ершовская шахта» и «Летописец» — среди достижений', g.run("ACHIEVEMENTS.some(a => a.id === 'bossSlayer') && ACHIEVEMENTS.some(a => a.id === 'chronicler')"));
check('кнопка «📖 Дневник»', /openDiary\(\)">📖 Дневник/.test(html));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
