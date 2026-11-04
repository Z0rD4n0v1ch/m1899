// Проверки «Шахты дня» и событий (землетрясение, заказ скупщика).
// Запуск: node events.test.js — гоняет настоящий miner-1899.html в песочнице vm.
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
function boot({ store = {}, nav = {}, tg } = {}) {
    const els = {}, notes = [];
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body: { appendChild(n) { notes.push(n.textContent); }, classList: makeEl().classList }, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        window: { addEventListener() {}, Telegram: tg ? { WebApp: tg } : undefined }, navigator: nav,
        requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => true,
        console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), notes, store };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }

console.log('Шахта дня');
let g = boot();
check('в окне новой игры кнопка «📅 Шахта дня»', /onclick="chooseDaily\(\)">📅 Шахта дня/.test(html));
g.run('chooseDaily()');
const key = g.run('todayKey()');
check('режим «шахта дня» на сегодня, цель — дно шахты', g.run('mode.daily') === key && g.run('goal.id') === 'bottom' && !g.run('mode.hardcore') && !g.run('gameState.paused'));
const w1 = g.run('JSON.stringify(compressWorld())');
const g2 = boot(); g2.run('chooseDaily()');
check('у всех в один день — одна и та же шахта', g2.run('JSON.stringify(compressWorld())') === w1);
check('в другой день — другая', g.run("dailySeed('2026-11-02') !== dailySeed('2026-11-03')"));
g.run('updateUI()');
check('в панели — 📅', g.el('goalStat').textContent.startsWith('📅'));
const save = JSON.parse(g.run('JSON.stringify(createSaveData("t"))'));
check('режим в сохранении', save.mode.daily === key);
g.run(`newGame(true); loadSaveData(${JSON.stringify(save)})`);
check('загрузка — снова шахта дня', g.run('mode.daily') === key);
g.run('stats.playtime = 1180; run.deaths = 1; run.maxDepth = 785; run.reachedBottom = true; player.y = SURFACE_Y - 1; updateGoal();');
check('дно и наверх — финал с кнопкой «Поделиться»', g.el('finalModal').classList.contains('active') && g.el('finalInfo').innerHTML.includes('shareDaily()'));
check('в итогах — режим «Шахта дня»', g.el('finalInfo').innerHTML.includes('Шахта дня'));
check('рекорд записан отдельно для этого дня', g.run("records.some(r => r.daily === todayKey() && r.done && r.time === 1180)") && g.run('recordKind(records[records.length - 1])') === 'daily:' + key);
const shareText = g.run('dailyShareText(records[records.length - 1])');
check('текст для друзей: дата, время, смерти, ссылка', shareText.includes('Шахта дня') && shareText.includes('19 мин 40 с') && shareText.includes('смертей: 1') && shareText.includes('m1899/play'));
g.run('continueAfterFinal(); openRecords();');
check('в «Моих рекордах» — раздел «📅 Шахта дня»', g.el('recordsInfo').innerHTML.includes('📅 Шахта дня'));
let copied = null;
const g3 = boot({ nav: { clipboard: { writeText: t => { copied = t; return Promise.resolve(); } } } });
g3.run("chooseDaily(); stats.playtime = 900; run.maxDepth = 785; run.reachedBottom = true; player.y = SURFACE_Y - 1; updateGoal(); shareDaily();");
check('«Поделиться» в браузере — копирует результат', copied && copied.includes('15 мин 0 с'));
let link = null;
const g4 = boot({ tg: { openTelegramLink: u => { link = u; } } });
g4.run("chooseDaily(); stats.playtime = 900; run.maxDepth = 785; run.reachedBottom = true; player.y = SURFACE_Y - 1; updateGoal(); shareDaily();");
check('в Telegram — окно «Поделиться» Telegram', link && link.startsWith('https://t.me/share/url?url='));
g.run("newGame(true); chooseMode(false);");
check('обычная новая игра — уже не шахта дня', g.run('mode.daily') === null);

console.log('Землетрясение');
g = boot();
g.run(`chooseMode(false); chooseGoal('free'); generateWorld(4); creatures = []; resetHazards(); gameState.paused = false;
       const F = DEPTH_ORIGIN + 200; player.x = 60; player.y = F; fallTop = null;
       for (let y = F - 8; y <= F; y++) for (let x = 44; x <= 76; x++) world[y][x] = BLOCK_TYPES.AIR;
       for (let x = 44; x <= 76; x++) world[F - 9][x] = BLOCK_TYPES.STONE;`);
g.run('quakeIn = 0.05; updateEvents(0.1);');
check('глубже 60 м время вышло — земля дрожит, камни падают', g.notes.some(n => n.includes('Земля дрожит')) && g.run('fallingBlocks.length') > 0);
check('экран трясёт', g.run('shakeTime') > 0 && g.run('shakeOffset()').some(v => v !== 0));
check('прямо над головой не падает', g.run('fallingBlocks.every(b => Math.abs(b.x - Math.floor(player.x)) >= 2)'));
check('следующий толчок — через 5–12 минут', g.run('quakeIn') >= 300 && g.run('quakeIn') <= 720);
g.run('player.y = DEPTH_ORIGIN + 20; quakeIn = 0.05; fallingBlocks.length = 0; updateEvents(0.1);');
check('у поверхности (меньше 60 м) — не бывает', g.run('fallingBlocks.length') === 0 && g.run('quakeIn') > 0);
g.run("setSound('events', false); player.y = DEPTH_ORIGIN + 200; quakeIn = 0.01; updateEvents(0.1);");
check('события выключены в настройках — нет', g.run('quakeIn') > 0 && g.run('fallingBlocks.length') === 0);

console.log('Заказ скупщика');
g = boot();
g.run("chooseMode(false); chooseGoal('free'); stats.playtime = 600; run.maxDepth = 260; Math.random = () => 0.1;");
check('у лавки предлагается заказ', g.run('maybeOfferOrder()') === true && g.run('order !== null') && g.notes.some(n => n.includes('Заказ скупщика')));
const need = g.run('order.need'), ore = g.run('order.ore'), reward = g.run('order.reward');
check(`заказ: ${ore} ×${need}, награда ${reward} — вдвое (цена × количество сверху)`, reward === need * g.run(`oreByKey('${ore}').price`));
check('второй сразу — нет', g.run('maybeOfferOrder()') === false);
g.run('updateUI()');
check('в панели цели — ход заказа', g.el('goalStat').textContent.includes('📜') && g.el('goalStat').textContent.includes(`0/${need}`));
const money0 = g.run('stats.money');
g.run(`for (let i = 0; i < ${need}; i++) addToBackpack(BLOCK_TYPES.${ore.toUpperCase()}); player.x = SHOP_X + 1; player.y = SURFACE_Y - 1; backpackTier = 2; sellBackpack();`);
check('принёс и продал — доплата и сообщение', g.run('order') === null && g.run('stats.money') - money0 >= reward && g.notes.some(n => n.includes('Заказ выполнен')));
g.run("stats.playtime = 2000; lastOrderAt = 0; maybeOfferOrder(); stats.playtime += 901; updateEvents(0.1);");
check('срок вышел — заказ снимается', g.run('order') === null && g.notes.some(n => n.includes('не выполнен')));
g.run("stats.playtime = 3000; lastOrderAt = 0; maybeOfferOrder();");
const s2 = JSON.parse(g.run('JSON.stringify(createSaveData("t"))'));
check('заказ в сохранении', s2.order && s2.order.need > 0);
g.run('order = null;'); g.run(`loadSaveData(${JSON.stringify(s2)})`);
check('и загружается', g.run('order !== null && order.need') === s2.order.need);
g.run('newGame(true);');
check('новая игра — без заказа', g.run('order') === null);
check('настройка «События»', /id="optEvents"/.test(html));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
