// กติกาเกมคำคม (Thai Scrabble-like) — ตรรกะล้วน ไม่ผูกกับ DOM
// ใช้ร่วมกันได้ทั้งเบราว์เซอร์และ Node (สำหรับเทสต์)

export const SIZE = 11;
export const RACK_SIZE = 9;
export const BINGO_BONUS = 50;

export const PREFIX_VOWELS = new Set(['เ', 'แ', 'โ', 'ใ', 'ไ']);
export const TONES = new Set(['่', '้', '๊', '๋', '็']);
export const VOWELS = new Set([
  'ะ', 'า', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'เ', 'แ', 'โ', 'ใ', 'ไ', 'ำ', 'อ', 'ั', '็', '์', 'ๆ',
]);

// ตารางตัวคูณ 11x11 — '*' = ช่องดาวกลาง (2 เท่าคำ)
export const MULTIPLIERS = [
  ['TW', '', '', 'DL', '', '', '', 'DL', '', '', 'TW'],
  ['', 'DW', '', '', '', 'TL', '', '', '', 'DW', ''],
  ['', '', 'DW', '', '', '', '', '', 'DW', '', ''],
  ['DL', '', '', 'DW', '', '', '', 'DW', '', '', 'DL'],
  ['', '', '', '', 'DL', '', 'DL', '', '', '', ''],
  ['', 'TL', '', '', '', '*', '', '', '', 'TL', ''],
  ['', '', '', '', 'DL', '', 'DL', '', '', '', ''],
  ['DL', '', '', 'DW', '', '', '', 'DW', '', '', 'DL'],
  ['', '', 'DW', '', '', '', '', '', 'DW', '', ''],
  ['', 'DW', '', '', '', 'TL', '', '', '', 'DW', ''],
  ['TW', '', '', 'DL', '', '', '', 'DL', '', '', 'TW'],
];

export const emptyBoard = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

export const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** ข้อความของช่องเดียว: สระนำหน้า + พยัญชนะ + สระตามหลัง + วรรณยุกต์ */
export function cellText(cell) {
  if (!cell) return '';
  const v = cell.v || '';
  const t = cell.t || '';
  return PREFIX_VOWELS.has(v) ? v + cell.c + t : cell.c + v + t;
}

const wordMultiplier = (r, c) => {
  const m = MULTIPLIERS[r][c];
  return m === 'TW' ? 3 : m === 'DW' || m === '*' ? 2 : 1;
};

const letterMultiplier = (r, c) => {
  const m = MULTIPLIERS[r][c];
  return m === 'TL' ? 3 : m === 'DL' ? 2 : 1;
};

/** รวบรวมคำที่เกิดจากช่อง (r,c) ตามแนวที่กำหนด */
function collect(board, r, c, dr, dc) {
  let sr = r, sc = c;
  while (inBounds(sr - dr, sc - dc) && board[sr - dr][sc - dc]) {
    sr -= dr;
    sc -= dc;
  }
  const cells = [];
  while (inBounds(sr, sc) && board[sr][sc]) {
    cells.push([sr, sc]);
    sr += dr;
    sc += dc;
  }
  return cells;
}

/**
 * ตรวจการเล่นหนึ่งตา
 * @param board ตารางปัจจุบัน (ยังไม่ใส่เบี้ยใหม่)
 * @param placements [{r,c,c,v,t}]
 * @param dict Set ของคำที่ยอมรับ
 */
export function validateMove(board, placements, dict, letterValue) {
  if (!placements.length) return { ok: false, error: 'ยังไม่ได้วางเบี้ย' };

  const next = board.map((row) => row.slice());
  for (const p of placements) {
    if (!inBounds(p.r, p.c)) return { ok: false, error: 'วางนอกกระดาน' };
    if (next[p.r][p.c]) return { ok: false, error: 'ช่องนี้มีเบี้ยอยู่แล้ว' };
    next[p.r][p.c] = { c: p.c_, v: p.v || '', t: p.t || '' };
  }

  const rows = new Set(placements.map((p) => p.r));
  const cols = new Set(placements.map((p) => p.c));
  const horizontal = rows.size === 1;
  const vertical = cols.size === 1;
  if (!horizontal && !vertical) return { ok: false, error: 'ต้องวางในแนวเดียวกัน' };

  // ต้องติดกันไม่มีช่องว่าง
  const line = horizontal
    ? [...placements].sort((a, b) => a.c - b.c)
    : [...placements].sort((a, b) => a.r - b.r);
  for (let i = 1; i < line.length; i++) {
    const gap = horizontal ? line[i].c - line[i - 1].c : line[i].r - line[i - 1].r;
    if (gap !== 1) return { ok: false, error: 'เบี้ยต้องเรียงติดกัน' };
  }

  const boardWasEmpty = board.every((row) => row.every((cell) => !cell));
  const mid = Math.floor(SIZE / 2);
  if (boardWasEmpty) {
    const coversCenter = placements.some((p) => p.r === mid && p.c === mid);
    if (!coversCenter) return { ok: false, error: 'ตาแรกต้องผ่านช่องดาวกลาง' };
  } else {
    const touches =
      placements.some((p) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
          const rr = p.r + dr, cc = p.c + dc;
          return inBounds(rr, cc) && board[rr][cc];
        })
      ) || formsLineWithExisting(board, placements, horizontal);
    if (!touches) return { ok: false, error: 'คำใหม่ต้องเชื่อมกับเบี้ยเดิม' };
  }

  // เก็บคำทั้งหมด: คำหลัก + คำที่ตัดขวาง
  const words = [];
  const seen = new Set();
  const addWord = (cells) => {
    if (cells.length < 2) return;
    const key = cells.map(([r, c]) => `${r},${c}`).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    words.push(cells);
  };

  if (horizontal) {
    const r = line[0].r;
    addWord(collect(next, r, line[0].c, 0, 1));
  } else {
    const c = line[0].c;
    addWord(collect(next, line[0].r, c, 1, 0));
  }

  for (const p of placements) {
    const cross = horizontal
      ? collect(next, p.r, p.c, 1, 0)
      : collect(next, p.r, p.c, 0, 1);
    addWord(cross);
  }

  let total = 0;
  const detail = [];
  for (const cells of words) {
    const text = cells.map(([r, c]) => cellText(next[r][c])).join('');
    if (!dict.has(text)) {
      return { ok: false, error: `ไม่พบคำ "${text}" ในพจนานุกรม`, words: detail };
    }
    let wm = 1;
    let sum = 0;
    for (const [r, c] of cells) {
      const isNew = placements.some((p) => p.r === r && p.c === c);
      const base = letterValue(next[r][c].c) || 1;
      sum += base * (isNew ? letterMultiplier(r, c) : 1);
      if (isNew) wm *= wordMultiplier(r, c);
    }
    const score = sum * wm;
    detail.push({ text, score, cells });
    total += score;
  }

  if (placements.length === RACK_SIZE) total += BINGO_BONUS;
  return { ok: true, words: detail, total, board: next };
}

function formsLineWithExisting(board, placements, horizontal) {
  const r = placements[0].r;
  const c = placements[0].c;
  if (horizontal) {
    return (inBounds(r, c - 1) && board[r][c - 1]) || (inBounds(r, c + 1) && board[r][c + 1]);
  }
  return (inBounds(r - 1, c) && board[r - 1][c]) || (inBounds(r + 1, c) && board[r + 1][c]);
}

/** สร้างถุงเบี้ยจากข้อมูลตัวอักษร */
export function makeBag(letters) {
  const bag = [];
  for (const [ch, meta] of Object.entries(letters)) {
    for (let i = 0; i < meta.count; i++) bag.push({ c: ch, v: '', t: '' });
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function draw(bag, rack, size = RACK_SIZE) {
  while (rack.length < size && bag.length) rack.push(bag.pop());
  return rack;
}
