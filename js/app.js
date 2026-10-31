import {
  ROWS, COLS, RACK_SIZE, CENTER, PAPER, PREFIX_VOWELS,
  emptyBoard, validateMove, liftOld, makeBag, draw, rackValue, cellText,
} from './rules.mjs';

const $ = (id) => document.getElementById(id);
const BOARD_EL = $('board');
const RACK_EL = $('rack');
const PALETTE_EL = $('palette');
const TOAST = $('toast');

const VOWEL_BUTTONS = ['ะ', 'า', 'ำ', 'เ', 'แ', 'โ', 'ใ', 'ไ'];
const PAPER_BUTTONS = ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ั', '่', '้', '๊', '๋', '์'];

const state = {
  dict: null, tiles: null, layout: null,
  board: null, bag: [], racks: [[], []], scores: [0, 0],
  turn: 0, pending: [], selected: null, passes: 0, over: false, last: null,
};

const tileValue = (ch) => {
  const t = state.tiles?.[ch];
  if (t) return t.value;
  const pair = Object.keys(state.tiles || {}).find((k) => k.includes('/') && k.split('/').includes(ch));
  return pair ? state.tiles[pair].value : 1;
};

let toastTimer;
function toast(msg) {
  TOAST.textContent = msg;
  TOAST.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => TOAST.classList.remove('show'), 2600);
}

async function boot() {
  if (!state.dict) {
    const [dict, tiles, layout] = await Promise.all([
      fetch('data/dict.json').then((r) => r.json()),
      fetch('data/tiles.json').then((r) => r.json()),
      fetch('data/board.json').then((r) => r.json()),
    ]);
    state.dict = new Set(dict.words);
    state.tiles = tiles.tiles;
    state.layout = layout.cells;
    document.querySelector('.sub').textContent =
      `กระดาน 15×9 · พจนานุกรม ${dict.words.length.toLocaleString('en-US')} คำ · เบี้ย ${tiles.total_tiles} ตัว`;
  }
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
  renderAll();
}

/* ---------- วาด ---------- */
const MULT_TEXT = { W2: '2คำ', W3: '3คำ', L2: '2ตัว', L3: '3ตัว', L4: '4ตัว', L5: '5ตัว' };

function renderBoard() {
  BOARD_EL.style.setProperty('--cols', COLS);
  BOARD_EL.innerHTML = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cell';
      btn.dataset.r = r;
      btn.dataset.c = c;
      const m = state.layout[r][c];
      const pend = state.pending.find((p) => p.r === r && p.c === c);
      const filled = pend ? { c: pend.tile.c, v: pend.v, t: pend.t, blank: pend.tile.blank } : state.board[r][c];

      if (filled) {
        btn.classList.add('has-tile');
        btn.innerHTML = tileHTML(filled, pend ? 'pending' : '', pend ? null : tileValue(filled.c));
      } else if (m !== 'n') {
        btn.classList.add(`m-${m}`);
        btn.textContent = MULT_TEXT[m];
      }
      if (r === CENTER[0] && c === CENTER[1] && !filled) btn.classList.add('center');
      btn.addEventListener('click', () => onCellClick(r, c));
      BOARD_EL.appendChild(btn);
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
    const pairHint = tile.pair ? `<span class="pair">${tile.pair.join('/')}</span>` : '';
    btn.innerHTML = `<span class="top"></span><span class="mid">${tile.c}</span><span class="bot"></span>
      <span class="val">${tile.value}</span>${pairHint}`;
    btn.addEventListener('click', () => {
      if (state.selected === i && tile.pair) {
        // แตะซ้ำ = สลับตัวอักษรของเบี้ยคู่
        tile.c = tile.c === tile.pair[0] ? tile.pair[1] : tile.pair[0];
        renderRack();
        return;
      }
      state.selected = state.selected === i ? null : i;
      renderRack();
    });
    RACK_EL.appendChild(btn);
  });
}

function renderPalette() {
  PALETTE_EL.innerHTML = '';
  const target = state.pending[state.pending.length - 1];
  const add = (ch, group, cls) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ch;
    b.className = cls || '';
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
  PAPER_BUTTONS.forEach((v) => add(v, v === '่' || v === '้' || v === '๊' || v === '๋' ? 'tone' : 'vowel', 'paper'));
}

function renderScores() {
  $('s0').textContent = state.scores[0];
  $('s1').textContent = state.scores[1];
  $('p0').classList.toggle('active', state.turn === 0 && !state.over);
  $('p1').classList.toggle('active', state.turn === 1 && !state.over);
  const bagLeft = state.bag.length;
  $('turnLabel').textContent = state.over
    ? 'จบเกม'
    : `ตาผู้เล่น ${state.turn + 1} · ในถุง ${bagLeft}`;
}

/* ---------- โต้ตอบ ---------- */
function onCellClick(r, c) {
  if (state.over) return;
  const idx = state.pending.findIndex((p) => p.r === r && p.c === c);
  if (idx >= 0) {
    const [removed] = state.pending.splice(idx, 1);
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

const placements = () => state.pending.map((p) => ({
  r: p.r, c: p.c, c_: p.tile.c, v: p.v, t: p.t, blank: p.tile.blank,
}));

function updatePreview() {
  const w = $('previewWords'), s = $('previewScore');
  if (!state.pending.length) { w.textContent = '—'; s.textContent = ''; return; }
  const res = validateMove({ board: state.board, layout: state.layout, placements: placements(), dict: state.dict, tileValue });
  if (!res.ok) { w.textContent = res.error; s.textContent = ''; return; }
  w.textContent = res.words.map((x) => `${x.text} (${x.score})`).join(' · ');
  s.textContent = `+${res.total}${res.bingo ? ` (รวมบิงโก ${res.bingo})` : ''}`;
}

function submit() {
  if (state.over) return;
  const res = validateMove({ board: state.board, layout: state.layout, placements: placements(), dict: state.dict, tileValue });
  if (!res.ok) return toast(res.error);
  // ยกคำเก่าออก เหลือคำล่าสุด
  state.board = liftOld(res.board, res.words);
  state.scores[state.turn] += res.total;
  state.pending = [];
  state.selected = null;
  state.passes = 0;
  draw(state.bag, state.racks[state.turn]);
  const played = state.turn;
  state.turn = 1 - state.turn;
  toast(`+${res.total} คะแนน · ${res.words.map((x) => x.text).join(', ')}`);
  checkEnd(played);
  renderAll();
}

function checkEnd(justPlayed) {
  if (state.over) return;
  const bagEmpty = state.bag.length === 0;
  if (bagEmpty && state.racks[justPlayed].length === 0) {
    const bonus = rackValue(state.racks[1 - justPlayed]) * 2;
    state.scores[justPlayed] += bonus;
    state.over = true;
    toast(`จบเกม! ผู้เล่น ${justPlayed + 1} เบี้ยหมด ได้โบนัส ${bonus}`);
    return;
  }
  if (bagEmpty && state.passes >= 6) {
    state.scores[0] -= rackValue(state.racks[0]);
    state.scores[1] -= rackValue(state.racks[1]);
    state.over = true;
    const [a, b] = state.scores;
    toast(a === b ? 'จบเกม · เสมอกัน' : `จบเกม · ผู้เล่น ${a > b ? 1 : 2} ชนะ`);
  }
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
  checkEnd(state.turn);
  renderAll();
}

function exchange() {
  if (state.over) return;
  const rack = state.racks[state.turn];
  if (state.selected === null) return toast('เลือกเบี้ยที่ต้องการเปลี่ยนก่อน');
  if (state.bag.length < 9) return toast('เปลี่ยนไม่ได้ — ในถุงเหลือน้อยกว่า 9 ตัว');
  const out = rack.splice(state.selected, 1)[0];
  state.bag.push(out);
  draw(state.bag, rack);
  state.selected = null;
  state.passes += 1;
  state.turn = 1 - state.turn;
  toast('เปลี่ยนเบี้ยแล้ว — เสียตานี้');
  renderAll();
}

$('btn-play').addEventListener('click', submit);
$('btn-recall').addEventListener('click', recall);
$('btn-pass').addEventListener('click', pass);
$('btn-exchange')?.addEventListener('click', exchange);
$('btn-new').addEventListener('click', boot);

function renderAll() {
  renderBoard();
  renderRack();
  renderPalette();
  renderScores();
  updatePreview();
}

boot();
