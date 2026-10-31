import {
  ROWS, COLS, CENTER, PAPER, emptyBoard, validateMove, liftOld,
  makeBag, draw, rackValue, makeTileValue,
} from './rules.mjs';
import { botMove } from './bot.mjs';

const $ = (id) => document.getElementById(id);
const BOARD_EL = $('board');
const RACK_EL = $('rack');
const PALETTE_EL = $('palette');
const TOAST = $('toast');
const SETUP = $('setup');
const SUMMARY = $('summary');

const state = {
  dict: null, tiles: null, layout: null, tileValue: null,
  board: null, bag: [], racks: [[], []], scores: [0, 0],
  turn: 0, pending: [], selected: null, passes: 0, over: false,
  mode: 'bot', level: 'medium', names: ['ผู้เล่น 1', 'บอท'], log: [], think: false,
};

let toastTimer;
function toast(msg, ms = 2400) {
  TOAST.textContent = msg;
  TOAST.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => TOAST.classList.remove('show'), ms);
}

async function loadData() {
  const [dict, tiles, layout] = await Promise.all([
    fetch('data/dict.json').then((r) => r.json()),
    fetch('data/tiles.json').then((r) => r.json()),
    fetch('data/board.json').then((r) => r.json()),
  ]);
  state.dict = new Set(dict.words);
  state.tiles = tiles.tiles;
  state.layout = layout.cells;
  state.tileValue = makeTileValue(tiles.tiles);
  $('sub').textContent =
    `กระดาน 15×9 · พจนานุกรม ${dict.words.length.toLocaleString('en-US')} คำ · เบี้ย ${tiles.total_tiles} ตัว`;
}

const LEVEL_NAME = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' };

function newGame({ mode, level }) {
  state.mode = mode;
  state.level = level;
  state.names = mode === 'bot'
    ? ['คุณครู', `บอท · ${LEVEL_NAME[level]}`]
    : ['ผู้เล่น 1', 'ผู้เล่น 2'];
  state.board = emptyBoard();
  state.bag = makeBag(state.tiles);
  state.racks = [[], []];
  draw(state.bag, state.racks[0]);
  draw(state.bag, state.racks[1]);
  state.scores = [0, 0];
  state.turn = 0;
  state.pending = [];
  state.selected = null;
  state.passes = 0;
  state.over = false;
  state.log = [];
  state.think = false;
  SETUP.hidden = true;
  SUMMARY.hidden = true;
  renderAll();
}

/* ---------- วาด ---------- */
const MULT_TEXT = { W2: '×2 คำ', W3: '×3 คำ', L2: '×2', L3: '×3', L4: '×4', L5: '×5' };

function renderBoard() {
  BOARD_EL.style.setProperty('--cols', COLS);
  BOARD_EL.innerHTML = '';
  for (let r = 0; r < ROWS + 1; r++) {
    // แถบสระ/วรรณยุกต์เหนือแต่ละแถว (+ แถบล่างสุด) = 10 แถบ x 15 ช่อง = 150 ช่อง
    const strip = document.createElement('div');
    strip.className = 'strip-row';
    for (let c = 0; c < COLS; c++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const pend = state.pending.find((p) => p.r === r && p.c === c);
      const cell = pend ? { marks: pend.marks } : state.board[r]?.[c];
      if (cell && cell.marks) slot.textContent = cell.marks;
      strip.appendChild(slot);
    }
    BOARD_EL.appendChild(strip);
    if (r === ROWS) break;

    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      const m = state.layout[r][c];
      const pend = state.pending.find((p) => p.r === r && p.c === c);
      const filled = pend ? { t: pend.tile.t, marks: pend.marks, blank: pend.tile.blank } : state.board[r][c];

      if (filled) {
        btn.classList.add('has-tile');
        btn.innerHTML = cellHTML(filled, pend ? 'pending' : '', pend ? null : (filled.blank ? 0 : state.tileValue(filled.t)));
      } else if (m !== 'n') {
        btn.classList.add(`m-${m}`);
        btn.textContent = MULT_TEXT[m] || m;
      }
      if (r === CENTER[0] && c === CENTER[1] && !filled) btn.classList.add('center');
      btn.addEventListener('click', () => onCellClick(r, c));
      BOARD_EL.appendChild(btn);
    }
  }
}

function cellHTML(cell, cls = '', value = null) {
  return `<span class="tile ${cls}">
    <span class="mid">${cell.t === '?' ? '★' : cell.t}</span>
    ${value !== null ? `<span class="val">${value}</span>` : ''}
  </span>`;
}

function renderRack() {
  RACK_EL.innerHTML = '';
  state.racks[state.turn].forEach((tile, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile' + (state.selected === i ? ' selected' : '');
    btn.innerHTML = `<span class="top"></span>
      <span class="mid">${tile.blank ? '★' : tile.t}</span>
      <span class="bot"></span>
      <span class="val">${tile.value}</span>
      ${tile.pair ? `<span class="pair">${tile.pair.join('/')}</span>` : ''}`;
    btn.addEventListener('click', () => {
      if (state.selected === i && tile.pair) {
        tile.t = tile.t === tile.pair[0] ? tile.pair[1] : tile.pair[0];
        renderRack();
        return;
      }
      state.selected = state.selected === i ? null : i;
      renderRack();
    });
    RACK_EL.appendChild(btn);
  });
  if (!state.racks[state.turn].length) RACK_EL.innerHTML = '<span class="empty">เบี้ยในมือหมด</span>';
}

function renderPalette() {
  PALETTE_EL.innerHTML = '';
  const last = state.pending[state.pending.length - 1];
  for (const mark of PAPER) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paper';
    b.textContent = mark;
    if (last && last.marks.includes(mark)) b.classList.add('on');
    b.addEventListener('click', () => {
      if (!last) return toast('วางเบี้ยบนกระดานก่อน แล้วค่อยเติมสระ/วรรณยุกต์');
      last.marks = last.marks.includes(mark) ? last.marks.replace(mark, '') : last.marks + mark;
      renderAll();
    });
    PALETTE_EL.appendChild(b);
  }
}

function renderScores() {
  $('s0').textContent = state.scores[0];
  $('s1').textContent = state.scores[1];
  $('n0').textContent = state.names[0];
  $('n1').textContent = state.names[1];
  $('p0').classList.toggle('active', state.turn === 0 && !state.over);
  $('p1').classList.toggle('active', state.turn === 1 && !state.over);
  $('turnLabel').textContent = state.over
    ? 'จบเกม'
    : state.think
      ? 'บอทกำลังคิด…'
      : `ตา: ${state.names[state.turn]} · ในถุง ${state.bag.length}`;
  const isBot = state.mode === 'bot' && state.turn === 1;
  ['btn-play', 'btn-recall', 'btn-exchange', 'btn-pass'].forEach((id) => { $(id).disabled = isBot || state.over; });
}

/* ---------- โต้ตอบ ---------- */
function onCellClick(r, c) {
  if (state.over || state.think) return;
  if (state.mode === 'bot' && state.turn === 1) return;
  const idx = state.pending.findIndex((p) => p.r === r && p.c === c);
  if (idx >= 0) {
    state.racks[state.turn].push(state.pending[idx].tile);
    state.pending.splice(idx, 1);
    renderAll();
    return;
  }
  if (state.board[r][c]) return toast('ช่องนี้มีเบี้ยอยู่แล้ว');
  if (state.selected === null) return toast('เลือกเบี้ยจากมือก่อน');
  const tile = state.racks[state.turn][state.selected];
  state.racks[state.turn].splice(state.selected, 1);
  state.pending.push({ r, c, tile, marks: '' });
  state.selected = null;
  renderAll();
}

const toPlacements = () => state.pending.map((p) => ({
  r: p.r, c: p.c, t: p.tile.t, marks: p.marks, blank: p.tile.blank,
}));

function updatePreview() {
  const w = $('previewWords'), s = $('previewScore');
  if (!state.pending.length) { w.textContent = '—'; s.textContent = ''; return; }
  const res = validateMove({ board: state.board, layout: state.layout, placements: toPlacements(), dict: state.dict, tileValue: state.tileValue });
  if (!res.ok) { w.textContent = res.error; s.textContent = ''; return; }
  w.textContent = res.words.map((x) => `${x.text} (${x.score})`).join(' · ');
  s.textContent = `+${res.total}${res.bingo ? ` · บิงโก +${res.bingo}` : ''}`;
}

function applyMove(res, who) {
  state.board = liftOld(res.board, res.words);
  state.scores[who] += res.total;
  state.log.push({ who, words: res.words.map((w) => w.text), score: res.total });
  state.pending = [];
  state.selected = null;
  state.passes = 0;
  draw(state.bag, state.racks[who]);
}

function submit() {
  if (state.over || state.think) return;
  const res = validateMove({ board: state.board, layout: state.layout, placements: toPlacements(), dict: state.dict, tileValue: state.tileValue });
  if (!res.ok) return toast(res.error);
  const who = state.turn;
  applyMove(res, who);
  toast(`+${res.total} · ${res.words.map((x) => x.text).join(', ')}`);
  if (finishIfDone(who)) return;
  state.turn = 1 - who;
  renderAll();
  maybeBot();
}

function maybeBot() {
  if (state.mode !== 'bot' || state.turn !== 1 || state.over) return;
  state.think = true;
  renderAll();
  setTimeout(() => {
    const mv = botMove({
      board: state.board, layout: state.layout, rack: state.racks[1],
      dict: state.dict, tileValue: state.tileValue, level: state.level,
    });
    state.think = false;
    if (!mv) {
      toast('บอทผ่านตา');
      state.passes += 1;
      state.turn = 0;
      renderAll();
      return;
    }
    const res = validateMove({ board: state.board, layout: state.layout, placements: mv.placements, dict: state.dict, tileValue: state.tileValue });
    if (!res.ok) { toast('บอทคิดผิดพลาด'); state.turn = 0; renderAll(); return; }
    mv.placements.forEach((p) => {
      const i = state.racks[1].findIndex((t) => (t.pair ? t.pair.includes(p.t) : t.t === p.t));
      if (i >= 0) state.racks[1].splice(i, 1);
    });
    applyMove(res, 1);
    toast(`บอท: ${res.words.map((x) => x.text).join(', ')} +${res.total}`);
    if (finishIfDone(1)) return;
    state.turn = 0;
    renderAll();
  }, 450);
}

function finishIfDone(lastPlayer) {
  const bagEmpty = state.bag.length === 0;
  if (bagEmpty && state.racks[lastPlayer].length === 0) {
    const bonus = rackValue(state.racks[1 - lastPlayer]) * 2;
    state.scores[lastPlayer] += bonus;
    endGame(`เบี้ยหมดมือ · ได้โบนัส 2 เท่าของคู่ต่อสู้ (+${bonus})`);
    return true;
  }
  if (bagEmpty && state.passes >= 6) {
    state.scores[0] -= rackValue(state.racks[0]);
    state.scores[1] -= rackValue(state.racks[1]);
    endGame('ถุงหมดและผ่านครบ 6 ครั้ง · หักแต้มเบี้ยคงเหลือ');
    return true;
  }
  return false;
}

function endGame(reason) {
  state.over = true;
  renderAll();
  const [a, b] = state.scores;
  const win = a === b ? 'เสมอกัน' : `${state.names[a > b ? 0 : 1]} ชนะ`;
  $('summaryTitle').textContent = `${win} · ${a} : ${b}`;
  $('summaryReason').textContent = reason;
  const rows = state.log.map((l, i) =>
    `<tr><td>${i + 1}</td><td>${state.names[l.who]}</td><td>${l.words.join(', ')}</td><td>${l.score}</td></tr>`
  ).join('');
  $('summaryBody').innerHTML = rows || '<tr><td colspan="4">ไม่มีตาเดิน</td></tr>';
  SUMMARY.hidden = false;
}

function recall() {
  state.pending.forEach((p) => state.racks[state.turn].push(p.tile));
  state.pending = [];
  state.selected = null;
  renderAll();
}

function pass() {
  if (state.over) return;
  recall();
  state.passes += 1;
  state.turn = 1 - state.turn;
  if (state.bag.length > 0 && state.passes >= 4) {
    state.board = emptyBoard();
    state.passes = 0;
    toast('ผ่านครบ 4 ครั้ง — เริ่มใหม่ที่ดาวกลาง');
  }
  renderAll();
  maybeBot();
}

function exchange() {
  if (state.over) return;
  if (state.selected === null) return toast('เลือกเบี้ยที่ต้องการเปลี่ยนก่อน');
  if (state.bag.length < 9) return toast('เปลี่ยนไม่ได้ — ในถุงเหลือน้อยกว่า 9 ตัว');
  const out = state.racks[state.turn].splice(state.selected, 1)[0];
  state.bag.unshift(out);
  draw(state.bag, state.racks[state.turn]);
  state.selected = null;
  state.turn = 1 - state.turn;
  toast('เปลี่ยนเบี้ยแล้ว — เสียตานี้');
  renderAll();
  maybeBot();
}

function renderAll() {
  renderBoard();
  renderRack();
  renderPalette();
  renderScores();
  updatePreview();
}

$('btn-play').addEventListener('click', submit);
$('btn-recall').addEventListener('click', recall);
$('btn-pass').addEventListener('click', pass);
$('btn-exchange').addEventListener('click', exchange);
$('btn-new').addEventListener('click', () => { SETUP.hidden = false; });
$('btn-start').addEventListener('click', () => {
  const mode = document.querySelector('input[name=mode]:checked').value;
  const level = document.querySelector('input[name=level]:checked')?.value || 'medium';
  newGame({ mode, level });
});
$('btn-again').addEventListener('click', () => { SUMMARY.hidden = true; SETUP.hidden = false; });

document.querySelectorAll('input[name=mode]').forEach((el) => el.addEventListener('change', () => {
  const isBot = document.querySelector('input[name=mode]:checked').value === 'bot';
  $('levelBox').classList.toggle('dim', !isBot);
}));

loadData().then(() => {
  const q = new URLSearchParams(location.search);
  if (q.has('auto')) {
    newGame({ mode: q.get('mode') || 'bot', level: q.get('level') || 'medium' });
  } else {
    SETUP.hidden = false;
  }
});
