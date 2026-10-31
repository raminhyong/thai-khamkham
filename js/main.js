import {
  SIZE, RACK_SIZE, MULTIPLIERS, emptyBoard, validateMove, cellText,
  makeBag, draw, PREFIX_VOWELS, TONES,
} from './rules.mjs';

const BOARD_EL = document.getElementById('board');
const RACK_EL = document.getElementById('rack');
const PALETTE_EL = document.getElementById('palette');
const PREVIEW_WORDS = document.getElementById('previewWords');
const PREVIEW_SCORE = document.getElementById('previewScore');
const TURN_LABEL = document.getElementById('turnLabel');
const TOAST = document.getElementById('toast');

const VOWEL_BUTTONS = ['ะ', 'า', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ั', 'ำ', '็', '์', 'เ', 'แ', 'โ', 'ใ', 'ไ'];
const TONE_BUTTONS = ['่', '้', '๊', '๋'];

const state = {
  dict: null,
  letters: {},
  board: emptyBoard(),
  bag: [],
  racks: [[], []],
  scores: [0, 0],
  turn: 0,
  pending: [],      // {r,c,tile,v,t}
  selected: null,   // index ใน rack
  passes: 0,
  over: false,
};

const letterValue = (ch) => (state.letters[ch]?.value ?? 1);

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  TOAST.textContent = msg;
  TOAST.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => TOAST.classList.remove('show'), 2200);
}

/* ---------- เริ่มเกม ---------- */
async function boot() {
  if (!state.dict) {
    const res = await fetch('data/dict.json');
    const data = await res.json();
    state.dict = new Set(data.words);
    state.letters = data.letters;
    document.querySelector('.sub').textContent =
      `ต่อคำบนกระดาน · พจนานุกรม ${data.words.length.toLocaleString('en-US')} คำ`;
  }
  state.board = emptyBoard();
  state.bag = makeBag(state.letters);
  state.racks = [[], []];
  draw(state.bag, state.racks[0]);
  draw(state.bag, state.racks[1]);
  state.scores = [0, 0];
  state.turn = 0;
  state.pending = [];
  state.selected = null;
  state.passes = 0;
  state.over = false;
  renderAll();
}

/* ---------- วาดหน้าจอ ---------- */
function renderAll() {
  renderBoard();
  renderRack();
  renderPalette();
  renderScores();
  updatePreview();
}

function renderBoard() {
  BOARD_EL.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;
      const mult = MULTIPLIERS[r][c];
      const pending = state.pending.find((p) => p.r === r && p.c === c);
      const filled = pending ? { c: pending.tile.c, v: pending.v, t: pending.t } : state.board[r][c];

      if (filled) {
        el.classList.add('has-tile');
        el.innerHTML = tileHTML(filled, pending ? 'pending' : '', !pending ? letterValue(filled.c) : null);
      } else if (mult) {
        el.classList.add(mult === '*' ? 'm-star' : `m-${mult}`);
        el.textContent = mult === '*' ? '★' : mult;
      }
      el.addEventListener('click', () => onCellClick(r, c));
      BOARD_EL.appendChild(el);
    }
  }
}

function tileHTML(tile, cls = '', value = null) {
  const v = tile.v || '';
  const t = tile.t || '';
  const isPrefix = PREFIX_VOWELS.has(v);
  const top = [t, !isPrefix && !['ุ', 'ู'].includes(v) ? v : ''].filter(Boolean).join('');
  const bot = ['ุ', 'ู'].includes(v) ? v : '';
  return `<span class="tile ${cls}">
    <span class="top">${top}</span>
    <span class="mid">${isPrefix ? v : ''}${tile.c}</span>
    <span class="bot">${bot}</span>
    ${value ? `<span class="val">${value}</span>` : ''}
  </span>`;
}

function renderRack() {
  RACK_EL.innerHTML = '';
  state.racks[state.turn].forEach((tile, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tile' + (state.selected === i ? ' selected' : '');
    btn.innerHTML = `<span class="top"></span><span class="mid">${tile.c}</span><span class="bot"></span>
      <span class="val">${letterValue(tile.c)}</span>`;
    btn.addEventListener('click', () => {
      state.selected = state.selected === i ? null : i;
      renderRack();
    });
    RACK_EL.appendChild(btn);
  });
  if (!state.racks[state.turn].length) {
    RACK_EL.innerHTML = '<span style="font-size:12px;color:#6b7280;padding:8px">เบี้ยในมือหมดแล้ว</span>';
  }
}

function renderPalette() {
  PALETTE_EL.innerHTML = '';
  const target = state.pending[state.pending.length - 1];
  const add = (ch, group) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ch;
    const on = target && (group === 'tone' ? target.t === ch : target.v === ch);
    if (on) b.classList.add('on');
    b.addEventListener('click', () => {
      if (!target) return toast('วางเบี้ยบนกระดานก่อน แล้วค่อยเติมสระ/วรรณยุกต์');
      if (group === 'tone') target.t = target.t === ch ? '' : ch;
      else target.v = target.v === ch ? '' : ch;
      renderAll();
    });
    PALETTE_EL.appendChild(b);
  };
  VOWEL_BUTTONS.forEach((v) => add(v, 'vowel'));
  TONE_BUTTONS.forEach((t) => add(t, 'tone'));
}

function renderScores() {
  document.getElementById('s0').textContent = state.scores[0];
  document.getElementById('s1').textContent = state.scores[1];
  document.getElementById('p0').classList.toggle('active', state.turn === 0 && !state.over);
  document.getElementById('p1').classList.toggle('active', state.turn === 1 && !state.over);
  TURN_LABEL.textContent = state.over
    ? 'จบเกม'
    : `ตาของผู้เล่น ${state.turn + 1}`;
}

/* ---------- การโต้ตอบ ---------- */
function onCellClick(r, c) {
  if (state.over) return;
  const existing = state.pending.findIndex((p) => p.r === r && p.c === c);
  if (existing >= 0) {
    const [removed] = state.pending.splice(existing, 1);
    state.racks[state.turn].push(removed.tile);
    renderAll();
    return;
  }
  if (state.board[r][c]) return toast('ช่องนี้มีเบี้ยอยู่แล้ว');
  if (state.selected === null) return toast('เลือกเบี้ยจากมือก่อน');

  const tile = state.racks[state.turn][state.selected];
  state.racks[state.turn].splice(state.selected, 1);
  state.pending.push({ r, c, tile, v: '', t: '' });
  state.selected = null;
  renderAll();
}

function placements() {
  return state.pending.map((p) => ({ r: p.r, c: p.c, c_: p.tile.c, v: p.v, t: p.t }));
}

function updatePreview() {
  if (!state.pending.length) {
    PREVIEW_WORDS.textContent = '—';
    PREVIEW_SCORE.textContent = '';
    return;
  }
  const res = validateMove(state.board, placements(), state.dict, letterValue);
  if (!res.ok) {
    PREVIEW_WORDS.textContent = res.error;
    PREVIEW_SCORE.textContent = '';
    return;
  }
  PREVIEW_WORDS.textContent = res.words.map((w) => w.text).join(' · ');
  PREVIEW_SCORE.textContent = `+${res.total}`;
}

function submit() {
  if (state.over) return;
  const res = validateMove(state.board, placements(), state.dict, letterValue);
  if (!res.ok) return toast(res.error);

  state.board = res.board;
  state.scores[state.turn] += res.total;
  state.pending = [];
  state.selected = null;
  state.passes = 0;
  draw(state.bag, state.racks[state.turn]);
  state.turn = 1 - state.turn;
  if (!state.racks[state.turn].length && !state.bag.length) state.over = true;
  toast(`+${res.total} คะแนน · ${res.words.map((w) => w.text).join(', ')}`);
  renderAll();
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
  if (state.passes >= 4) {
    state.over = true;
    const [a, b] = state.scores;
    toast(a === b ? 'จบเกม · เสมอกัน' : `จบเกม · ผู้เล่น ${a > b ? 1 : 2} ชนะ`);
  }
  renderAll();
}

document.getElementById('btn-play').addEventListener('click', submit);
document.getElementById('btn-recall').addEventListener('click', recall);
document.getElementById('btn-pass').addEventListener('click', pass);
document.getElementById('btn-new').addEventListener('click', boot);

boot();
