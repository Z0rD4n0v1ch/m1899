// Проверки «Моих рекордов»: что записывается, лучшие по каждой цели, «Новый рекорд!»,
// хранение в браузере, отладка не записывается, окно, стирание.
// Запуск: node records.test.js — гоняет настоящий miner-1899.html в песочнице vm.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'miner-1899.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
function makeEl() {
    return { _html: '', get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; }, textContent: '', value: '', style: {}, children: [], dataset: {},
        classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, on) { (on === undefined ? !this._s.has(c) : on) ? this._s.add(c) : this._s.delete(c); } },
        appendChild(c) { this.children.push(c); }, remove() {}, focus() {}, click() {},
        getContext: () => new Proxy({}, { get: (t, k) => k in t ? t[k] : () => ({ addColorStop() {} }), set: (t, k, v) => (t[k] = v, true) }), width: 800, height: 600 };
}
let confirmAnswer = true;
function boot(store = {}) {
    const els = {}, handlers = {};
    const sb = {
        document: { getElementById: id => els[id] || (els[id] = makeEl()), createElement: () => makeEl(), body: { appendChild() {}, classList: makeEl().classList }, querySelectorAll: () => [] },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        window: { addEventListener(t, f) { handlers[t] = f; } }, requestAnimationFrame() {}, setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => confirmAnswer,
        console, Date, Math, JSON, Object, Proxy, Number, Set, Map, URL, WeakMap
    };
    vm.createContext(sb); vm.runInContext(script, sb);
    return { run: c => vm.runInContext(c, sb), el: id => els[id] || (els[id] = makeEl()), handlers, store };
}
let passed = 0, failed = 0;
function check(name, cond) { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } }
const store = {};
let g = boot(store);
function play(goalId, amount, { time = 600, depth = 300, score = 1000, hardcore = false, variant = 'oneLife' } = {}) {
    g.run(`gameOver = false; resetRun(); Object.assign(mode, { hardcore: ${hardcore}, variant: '${variant}' });
           Object.assign(goal, { id: '${goalId}', amount: ${amount || 0}, done: false });
           stats.playtime = ${time}; stats.score = ${score}; run.maxDepth = ${depth}; run.earned = 5000; el = 0;`.replace('el = 0;', ''));
}
const finish = () => { g.run('goal.done = true; showFinal();'); g.el('finalModal').classList.remove('active'); return g.el('finalInfo').innerHTML; };

console.log('Что записывается');
check('сначала пусто', g.run('records.length') === 0);
play('bottom', 0, { time: 900 });
let fin = finish();
check('цель выполнена — запись есть', g.run('records.length') === 1 && g.run('records[0].goal') === 'bottom' && g.run('records[0].done') === true);
check('первый раз — без «Нового рекорда» (не с чем сравнить)', !fin.includes('Новый рекорд'));
play('bottom', 0, { time: 700 }); fin = finish();
check('быстрее прошлого — «🏆 Новый рекорд!»', fin.includes('🏆 Новый рекорд!'));
play('bottom', 0, { time: 800 }); fin = finish();
check('медленнее лучшего — без отметки', !fin.includes('Новый рекорд'));
play('platinum', 0, { hardcore: true }); g.run("gameOver = true; showFinal('💀', 'Лава');");
check('смерть в «одной жизни» записана как проигрыш', g.run("records[records.length - 1].result") === 'died' && g.run("records[records.length - 1].done") === false);
play('free', 0, { time: 30, score: 50 }); g.run('newGame(true)');
check('свободная игра меньше минуты — не записывается', g.run("records.filter(r => r.goal === 'free').length") === 0);
play('free', 0, { time: 1800, score: 4200 }); g.run('newGame(true)');
check('свободная игра — записывается, когда начинают новую', g.run("records.filter(r => r.goal === 'free').length") === 1 && g.run("records.find(r => r.goal === 'free').score") === 4200);
play('wealth', 25000, { time: 3000 }); g.run('run.debugUsed = true;'); finish();
check('игра с отладкой — не записывается', g.run("records.filter(r => r.goal === 'wealth').length") === 0);
play('wealth', 15000, { time: 2500 }); finish(); play('wealth', 10000, { time: 1500 }); finish();
check('«Состояние» — отдельно по каждой сумме', g.run("records.filter(r => r.goal === 'wealth').map(r => recordKind(r)).sort().join()") === 'wealth:10000,wealth:15000');

console.log('Окно');
g.run('openRecords()');
const box = g.el('recordsInfo').innerHTML.replace(/[\u00a0\u202f]/g, ' ');
check('открывается, игра на паузе', g.el('recordsModal').classList.contains('active') && g.run('gameState.paused'));
check('по целям: дно, состояние 10 000 и 15 000, свободная игра', box.includes('Дно шахты') && box.includes('10 000') && box.includes('15 000') && box.includes('Свободная игра'));
const bottomPart = box.slice(box.indexOf('Дно шахты'), box.indexOf('</table>', box.indexOf('Дно шахты')));
check('лучший — первым, с 🥇: 11 мин 40 с', bottomPart.indexOf('🥇') < bottomPart.indexOf('11 мин 40 с') && bottomPart.indexOf('11 мин 40 с') < bottomPart.indexOf('13 мин 20 с') && bottomPart.indexOf('13 мин 20 с') < bottomPart.indexOf('15 мин 0 с'));
check('проигрыши в «одной жизни» посчитаны', box.includes('проигранных в «одной жизни»: 1'));
g.handlers.keydown({ code: 'Escape', preventDefault() {} });
check('ESC закрывает', !g.el('recordsModal').classList.contains('active'));
check('кнопка «🏆 Рекорды» под статистикой', /<div id="sideButtons">[\s\S]*?openRecords\(\)">🏆 Рекорды/.test(html));

console.log('Хранение');
const n = g.run('records.length');
const g2 = boot(store);
check(`в браузере: после перезапуска ${n} записей`, g2.run('records.length') === n);
check('в сохранение игры не попадают', !('records' in JSON.parse(g2.run('JSON.stringify(createSaveData("t"))'))));
check('мусор отбрасывается', boot({ miner_records: '[{"goal":"луна","time":1,"date":1},{"goal":"free","time":"x","date":1},5]' }).run('records.length') === 0 && boot({ miner_records: 'не json' }).run('records.length') === 0);
confirmAnswer = false; g2.run('clearRecords()');
check('«Стереть» переспрашивает — отказался, всё на месте', g2.run('records.length') === n);
confirmAnswer = true; g2.run('clearRecords()');
check('согласился — стёрто', g2.run('records.length') === 0 && boot(store).run('records.length') === 0);
g2.run('openRecords()');
check('пусто — подсказка', g2.el('recordsInfo').innerHTML.includes('Пока пусто'));

console.log(`\n${passed}/${passed + failed} проверок пройдено`);
process.exit(failed ? 1 : 0);
