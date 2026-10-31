// ตรรกะเกม "คำคม" ตามกติกาทางการ EduPLOYS
// กระดาน 15 คอลัมน์ x 9 แถว = 135 ช่อง · เบี้ย 104 ตัว · ช่องพิเศษ 6 แบบ
// ใช้ร่วมกันได้ทั้งเบราว์เซอร์และ Node (สำหรับเทสต์)

export const COLS = 15;
export const ROWS = 9;
export const RACK_SIZE = 9;
export const CENTER = [4, 7];

export const BINGO = { 6: 40, 7: 50, 8: 70, 9: 90 };

export const PREFIX_VOWELS = new Set(['เ', 'แ', 'โ', 'ใ', 'ไ']);
export const TONES = new Set(['่', '้', '๊', '๋', '็', '์']);

// เบี้ยกระดาษ: ใช้ได้ไม่จำกัด ไม่มีคะแนน
export const PAPER = ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', '่', '้', '๊', '๋', '์', 'ั'];

export const emptyBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

export const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/** ข้อความของช่องเดียว: สระนำหน้า + พยัญชนะ + สระตามหลัง + วรรณยุกต์ */
export function cellText(cell) {
  if (!cell) return '';
  const v = cell.v || '';
  const t = cell.t || '';
  return PREFIX_VOWELS.has(v) ? v + cell.c + t : cell.c + v + t;
}

/** ตัวคูณของช่อง อ่านจากผังกระดาน layout[r][c] */
export function multOf(layout, r, c) {
  const m = layout?.[r]?.[c] || 'n';
  return {
    word: m === 'W2' ? 2 : m === 'W3' ? 3 : 1,
    letter: m === 'L2' ? 2 : m === 'L3' ? 3 : m === 'L4' ? 4 : m === 'L5' ? 5 : 1,
  };
}

function collect(board, r, c, dr, dc) {
  let sr = r, sc = c;
  while (inBounds(sr - dr, sc - dc) && board[sr - dr][sc - dc]) {
    sr -= dr; sc -= dc;
  }
  const cells = [];
  while (inBounds(sr, sc) && board[sr][sc]) {
    cells.push([sr, sc]);
    sr += dr; sc += dc;
  }
  return cells;
}

/** ตรวจ + คิดคะแนนหนึ่งตา */
export function validateMove({ board, layout, placements, dict, tileValue }) {
  if (!placements.length) return { ok: false, error: 'ยังไม่ได้วางเบี้ย' };

  const next = board.map((row) => row.slice());
  for (const p of placements) {
    if (!inBounds(p.r, p.c)) return { ok: false, error: 'วางนอกกระดาน' };
    if (next[p.r][p.c]) return { ok: false, error: 'ช่องนี้มีเบี้ยอยู่แล้ว' };
    next[p.r][p.c] = { c: p.c_, v: p.v || '', t: p.t || '', blank: !!p.blank };
  }

  const rowsSet = new Set(placements.map((p) => p.r));
  const horizontal = rowsSet.size === 1;
  if (!horizontal && new Set(placements.map((p) => p.c)).size !== 1)
    return { ok: false, error: 'ต้องวางในแนวเดียวกัน' };

  const line = horizontal
    ? [...placements].sort((a, b) => a.c - b.c)
    : [...placements].sort((a, b) => a.r - b.r);
  for (let i = 1; i < line.length; i++) {
    const gap = horizontal ? line[i].c - line[i - 1].c : line[i].r - line[i - 1].r;
    if (gap !== 1) return { ok: false, error: 'เบี้ยต้องเรียงติดกัน' };
  }

  const wasEmpty = board.every((row) => row.every((cell) => !cell));
  if (wasEmpty) {
    if (!placements.some((p) => p.r === CENTER[0] && p.c === CENTER[1]))
      return { ok: false, error: 'ตาแรกต้องผ่านช่องดาวกลาง' };
  } else {
    const touches = placements.some((p) => {
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
        const rr = p.r + dr, cc = p.c + dc;
        return inBounds(rr, cc) && board[rr][cc];
      })) return true;
      // ต่อหน้าหรือต่อท้ายคำเดิมในแนวเดียวกัน (ลงแบบที่ 4)
      if (horizontal) {
        return (inBounds(p.r, p.c - 1) && board[p.r][p.c - 1]) ||
               (inBounds(p.r, p.c + 1) && board[p.r][p.c + 1]);
      }
      return (inBounds(p.r - 1, p.c) && board[p.r - 1][p.c]) ||
             (inBounds(p.r + 1, p.c) && board[p.r + 1][p.c]);
    });
    if (!touches) return { ok: false, error: 'คำใหม่ต้องเชื่อมกับเบี้ยเดิม' };
  }

  const words = [];
  const seen = new Set();
  const addWord = (cells) => {
    if (cells.length < 2) return;
    const key = cells.map(([r, c]) => `${r},${c}`).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    words.push(cells);
  };

  if (horizontal) addWord(collect(next, line[0].r, line[0].c, 0, 1));
  else addWord(collect(next, line[0].r, line[0].c, 1, 0));

  for (const p of placements) {
    addWord(horizontal ? collect(next, p.r, p.c, 1, 0) : collect(next, p.r, p.c, 0, 1));
  }

  const isNew = (r, c) => placements.some((p) => p.r === r && p.c === c);
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
      const cell = next[r][c];
      const base = cell.blank ? 0 : (tileValue(cell.c) || 1);
      const m = isNew(r, c) ? multOf(layout, r, c) : { word: 1, letter: 1 };
      sum += base * m.letter;
      wm *= m.word;
    }
    const score = sum * wm;
    detail.push({ text, score, cells });
    total += score;
  }

  const bonus = BINGO[placements.length] || 0;
  total += bonus;

  return { ok: true, words: detail, total, bingo: bonus, board: next };
}

/** ยกคำเก่าออก เหลือเฉพาะเบี้ยของคำล่าสุด */
export function liftOld(board, words) {
  const keep = new Set();
  for (const w of words) {
    const cells = Array.isArray(w.cells) ? w.cells : w;
    for (const [r, c] of cells) keep.add(`${r},${c}`);
  }
  const out = emptyBoard();
  for (const key of keep) {
    const [r, c] = key.split(',').map(Number);
    out[r][c] = board[r][c];
  }
  return out;
}

/** สร้างถุงเบี้ยจาก data/tiles.json (รองรับเบี้ยคู่ เช่น ฆ/ซ) */
export function makeBag(tiles) {
  const bag = [];
  for (const [name, meta] of Object.entries(tiles)) {
    for (let i = 0; i < meta.count; i++) {
      if (name.includes('/')) {
        const [a, b] = name.split('/');
        bag.push({ c: a, v: '', t: '', value: meta.value, blank: false, pair: [a, b] });
      } else if (name === 'ตัวว่าง') {
        bag.push({ c: '?', v: '', t: '', value: 0, blank: true });
      } else {
        bag.push({ c: name, v: '', t: '', value: meta.value, blank: false });
      }
    }
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

export const rackValue = (rack) => rack.reduce((s, t) => s + (t.value || 0), 0);
