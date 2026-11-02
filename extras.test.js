// Проверки небольших удобств: облачные сохранения в Telegram, геймпад, подсказки новичку,
// установка как приложение (manifest, service worker).
// Запуск: node extras.test.js — гоняет настоящий miner-1899.html в песочнице vm.
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
function boot({ store = {}, tg, nav = {}, loc = { search: '', hash: '', protocol: 'file:', hostname: '' }, confirmAns = true } = {}) {
    const els = {}, notes = [];
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body: { appendChild(n) { notes.push(n.textContent); }, classList: makeEl().classList }, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        window: { addEventListener() {}, Telegram: tg ? { WebApp: tg } : undefined }, location: loc, navigator: nav,
        requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => confirmAns,
        console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), notes, store };
}
function fakeCloud() {
    const data = {};
    return { data, setItem(k, v) { data[k] = v; }, getItem(k, cb) { cb(null, data[k] || ''); }, getItems(ks, cb) { const o = {}; ks.forEach(k => o[k] = data[k]); cb(null, o); }, removeItem(k) { delete data[k]; } };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }

console.log('Облачные сохранения в Telegram');
const cloud = fakeCloud();
const tg = { isVersionAtLeast: () => true, CloudStorage: cloud };
let g = boot({ tg });
g.run("chooseMode(false); chooseGoal('free'); generateWorld(7); stats.money = 777; cloudSavedAt = 0; autoSave();");
const meta = JSON.parse(cloud.data.save_meta);
check(`автосохранение ушло в облако частями по 4000 знаков (${meta.n} шт.)`, meta.n >= 1 && Object.keys(cloud.data).filter(k => k.startsWith('save_') && k !== 'save_meta').length === meta.n && cloud.data.save_0.length <= 4000);
g.run('stats.money = 1; autoSave();');
const cloudJson = () => { const m = JSON.parse(cloud.data.save_meta); return JSON.parse(Array.from({ length: m.n }, (_, i) => cloud.data['save_' + i]).join('')); };
check('в облаке целое сохранение; второе через секунду — не отправляется (не чаще раза в 20 с)', cloudJson().stats ? cloudJson().stats.money === 777 : cloudJson().money === 777);
const g2 = boot({ tg, store: {} });
g2.run("chooseMode(false); chooseGoal('free'); stats.money = 0;"); g2.run('cloudCheck()');
check('другое устройство без своего сохранения — облачное загружено', g2.run('stats.money') === 777 && g2.notes.some(n => n.includes('облака Telegram')));
const old = JSON.parse(g.store.miner_autosave); old.savedAt = Date.now() + 60000;
const g3 = boot({ tg, store: { miner_autosave: JSON.stringify(old) } });
g3.run("stats.money = 5;"); g3.run('cloudCheck()');
check('своё сохранение новее облачного — облако не предлагается', g3.run('stats.money') === 5);
const g4 = boot({ tg, confirmAns: false }); g4.run("stats.money = 3; cloudCheck();");
check('отказался — игра не тронута', g4.run('stats.money') === 3);
g.run("Object.assign(mode, { hardcore: true, variant: 'oneLife' }); hardcoreGameOver('Лава');");
check('«одна жизнь» закончилась — облачное сохранение забыто', !cloud.data.save_meta);
check('вне Telegram облака нет — без ошибок', boot().run("cloudSave('{}', true)") === false && boot().run('cloudCheck()') === false);

console.log('Геймпад');
let pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
g = boot({ nav: { getGamepads: () => [null, pad] } });
g.run("chooseMode(false); chooseGoal('free');");
pad.axes[0] = -0.9; g.run('pollGamepad()');
check('стик влево — клавиша A', g.run("keys['KeyA']") === true && g.notes.some(n => n.includes('Геймпад подключён')));
pad.axes[0] = 0; pad.buttons[0].pressed = true; g.run('pollGamepad()');
check('отпустил стик — A отпущена; кнопка A — копать (пробел)', g.run("keys['KeyA']") === false && g.run("keys['Space']") === true);
pad.buttons[0].pressed = false; pad.buttons[13].pressed = true; g.run('pollGamepad()');
check('крестовина вниз — S', g.run("keys['KeyS']") === true && g.run("keys['Space']") === false);
check('без геймпада — ничего', boot({ nav: { getGamepads: () => [null, null] } }).run('pollGamepad()') === false && boot().run('pollGamepad()') === false);

console.log('Подсказки новичку');
g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(3); player.y = SURFACE_Y - 1; run.maxDepth = 0; gameState.paused = false; tipClock = 0; updateTips(0.1);");
check('в начале — как копать', g.notes.some(n => n.includes('Копай')));
g.run('updateTips(0.1);');
check('по одной, не чаще раза в 8 секунд', g.notes.filter(n => n.includes('💡') || n.includes('🎒 Руда')).length === 0);
g.run('addToBackpack(BLOCK_TYPES.GOLD); tipClock = 0; updateTips(0.1);');
check('руда в рюкзаке — как продать', g.notes.some(n => n.includes('Руда в рюкзаке')));
const n1 = g.notes.length; g.run("tipClock = 0; updateTips(0.1); tipClock = 0; tipsShown.dig = 1; updateTips(0.1);");
check('каждая подсказка — один раз', g.notes.filter(n => n.includes('Копай')).length === 1);
check('запоминаются в браузере', boot({ store: g.store }).run("Object.keys(tipsShown).length") >= 2);
g.run("setSound('tips', false); tipsShown = {}; tipClock = 0;"); const n2 = g.notes.length; g.run('updateTips(0.1)');
check('выключил в настройках — молчат', g.notes.length === n2);
g.run("setSound('tips', true); resetTips();");
check('«Показать подсказки снова»', g.run('Object.keys(tipsShown).length') === 0);
check('в игре с отладкой — не показываются', (() => { const b = boot(); b.run("chooseMode(false); chooseGoal('free'); run.debugUsed = true; gameState.paused = false; tipClock = 0; updateTips(0.1);"); return !b.notes.some(n => n.includes('Копай')); })());

console.log('Установка как приложение');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'site/play/manifest.webmanifest'), 'utf8'));
check('manifest: название, иконки 192 и 512, отдельное окно', manifest.short_name && manifest.display === 'standalone' && manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'));
check('иконки и service worker лежат рядом с игрой на сайте', ['icon-192.png', 'icon-512.png', 'sw.js'].every(f => fs.existsSync(path.join(__dirname, 'site/play', f))));
check('в игре ссылка на manifest', /<link rel="manifest" href="manifest.webmanifest">/.test(html));
let regs = 0; const sw = { register: () => { regs++; return Promise.resolve(); } };
boot({ nav: { serviceWorker: sw }, loc: { search: '', hash: '', protocol: 'https:', hostname: 'z0rd4n0v1ch.github.io' } });
check('на сайте (https) — регистрируется', regs === 1);
boot({ nav: { serviceWorker: sw }, loc: { search: '', hash: '', protocol: 'file:', hostname: '' } });
check('из файла — нет', regs === 1);
boot({ nav: { serviceWorker: sw }, loc: { search: '', hash: '#tgWebAppData=1', protocol: 'https:', hostname: 'z0rd4n0v1ch.github.io' } });
check('в Telegram — нет', regs === 1);

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
