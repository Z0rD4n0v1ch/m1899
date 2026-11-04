// Проверки удобства: значки на руде для дальтоников, крупный текст, свои клавиши.
// Запуск: node access.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const texts = [];
function makeEl() {
    return { _h: '', get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; }, textContent: '', value: '', checked: false, style: {}, children: [], dataset: {},
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {},
        getContext: () => new Proxy({}, { get: (t, k) => k === 'fillText' ? s => texts.push(String(s)) : (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => (t[k] = v, true) }), width: 800, height: 600 };
}
function boot(store = {}) {
    const els = {}, handlers = {};
    const body = Object.assign(makeEl(), { appendChild() {} });
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem() {} },
        window: { addEventListener(t, f) { handlers[t] = f; } }, requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => false,
        console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap, Promise, Uint8Array
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), handlers, body, store };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }
const down = (g, code) => g.handlers.keydown({ code, key: '', repeat: false, preventDefault() {} });
const up = (g, code) => g.handlers.keyup({ code, preventDefault() {} });

console.log('Для дальтоников');
let g = boot();
g.run("chooseMode(false); chooseGoal('free'); generateWorld(3); player.x = 60; player.y = DEPTH_ORIGIN + 300; updateCamera();");
texts.length = 0; g.run('render()');
check('по умолчанию значков на руде нет', !texts.some(t => ['●', '◆', '▲', '✚'].includes(t)));
g.run("setSound('palette', true); for (let y = player.y - 3; y <= player.y + 3; y++) { world[y][55] = BLOCK_TYPES.GOLD; world[y][56] = BLOCK_TYPES.RUBY; world[y][57] = BLOCK_TYPES.LAVA; }");
texts.length = 0; g.run('render()');
check('включил — на руде значки: ● золото, ▲ рубин, ≈ лава (рубин и лава различимы)', texts.includes('●') && texts.includes('▲') && texts.includes('≈'));
check('у каждой руды свой значок', new Set(g.run('Object.values(ORE_GLYPH)')).size === g.run('Object.keys(ORE_GLYPH).length'));
check('запоминается', boot(g.store).run('settings.palette') === 'cb');

console.log('Крупный текст');
g = boot();
g.run("setSound('bigText', true)");
check('включил — класс big-text на странице', g.body.classList.contains('big-text'));
check('в CSS увеличены панели, окна и уведомления', /body\.big-text #ui, body\.big-text #leftPanel[^{]*\.notification[^{]*\.modal-content \{ zoom: 1\.18; \}/.test(html));
g.run("setSound('bigText', false)");
check('выключил — обычный', !g.body.classList.contains('big-text'));

console.log('Свои клавиши');
const store = {};
g = boot(store);
g.run("chooseMode(false); chooseGoal('free');");
g.run("startRemap('Space')");
check('«Изменить» — ждёт нажатия', g.run('remapWaiting') === 'Space' && g.el('keymapList').innerHTML.includes('нажми клавишу'));
down(g, 'KeyF');
check('нажал F — копать теперь на F', g.run("settings.keymap.Space") === 'KeyF' && g.run('remapWaiting') === null);
down(g, 'KeyF');
check('F работает как пробел', g.run("keys['Space']") === true);
up(g, 'KeyF');
check('отпустил — отпущен пробел', g.run("keys['Space']") === false);
down(g, 'Space');
check('сам пробел тоже работает (его никто не занял)', g.run("keys['Space']") === true); up(g, 'Space');
g.run("startRemap('KeyE')"); down(g, 'KeyQ');
check('лавку на Q: Q теперь лавка, а лестница по Q больше не срабатывает', g.run("mappedCode('KeyQ')") === 'KeyE');
g.run("startRemap('KeyQ')"); down(g, 'KeyF');
check('клавиша у другого действия — переходит к новому', g.run("settings.keymap.KeyQ") === 'KeyF' && g.run("settings.keymap.Space") === undefined);
g.run("startRemap('KeyA')"); down(g, 'Escape');
check('Esc — отмена', g.run('remapWaiting') === null && g.run("settings.keymap.KeyA") === undefined);
check('запоминается', boot(store).run("settings.keymap.KeyE") === 'KeyQ');
g.run('resetKeymap()');
check('«Как было» — всё по умолчанию', Object.keys(g.run('settings.keymap')).length === 0);
check('мусор в настройках отбрасывается', boot({ miner_settings: '{"keymap":{"KeyA":"<b>","Хак":"KeyZ","Space":"KeyF"}}' }).run('JSON.stringify(settings.keymap)') === '{"Space":"KeyF"}');
check('в настройках: удобство и свои клавиши', /id="optPalette"[\s\S]*id="optBigText"[\s\S]*id="keymapList"/.test(html));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
