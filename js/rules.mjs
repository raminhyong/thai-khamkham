// ตรรกะเกม "คำคม" ตามกติกาทางการ EduPLOYS
// โมเดลช่อง: { t: ตัวอักษรบนเบี้ยพลาสติก, marks: สระบน-ล่าง/วรรณยุกต์ (เบี้ยกระดาษ ไม่มีคะแนน) }
//   - เบี้ยพลาสติก: พยัญชนะ, สระ า ำ เ แ ไ ใ โ ะ, และเบี้ยว่าง (?)
//   - เบี้ยกระดาษ: ิ ี ึ ื ุ ู ั ่ ้ ๊ ๋ ์ — ใช้ไม่จำกัด ไม่มีคะแนน
// กระดาน 15 คอลัมน์ x 9 แถว = 135 ช่อง · เบี้ย 104 ตัว · ช่องพิเศษ 6 แบบ

export const COLS = 15;
export const ROWS = 9;
export const RACK_SIZE = 9;
export const CENTER = [4, 7];

export const BINGO = { 6: 40, 7: 50, 8: 70, 9: 90 };

// เบี้ยกระดาษ (ใช้ได้ไม่จำกัด)
export const PAPER = ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ั', '่', '้', '๊', '๋', '์'];
export const PLASTIC_VOWELS = new Set(['า', 'ำ', 'เ', 'แ', 'ไ', 'ใ', 'โ', 'ะ']);

export const emptyBoard = () =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(null));

export const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/** ข้อความของช่อง = ตัวเบี้ย + ไม้/สระบน-ล่าง */
export const cellText = (cell) => (cell ? (cell.t || '') + (cell.marks || '') : '');

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

/** ตรวจ + คิดคะแนนหนึ่งตา
 * placements: [{ r, c, t, marks?, blank? }]  (t = ตัวอักษรบนเบี้ย)
 */
export function validateMove({ board, layout, placements, dict, tileValue }) {
  if (!placements.length) return { ok: false, error: 'ยังไม่ได้วางเบี้ย' };

  const next = board.map((row) => row.slice());
  for (const p of placements) {
    if (!inBounds(p.r, p.c)) return { ok: false, error: 'วางนอกกระดาน' };
    if (next[p.r][p.c]) return { ok: false, error: 'ช่องนี้มีเบี้ยอยู่แล้ว' };
    if (!p.blank && PAPER.includes(p.t))
      return { ok: false, error: 'สระบน-ล่าง/วรรณยุกต์เป็นเบี้ยกระดาษ ต้องเกาะช่องพยัญชนะ ไม่ใช่ลงเป็นเบี้ยเอง' };
    next[p.r][p.c] = { t: p.t, marks: p.marks || '', blank: !!p.blank };
  }

  const horizontal = new Set(placements.map((p) => p.r)).size === 1;
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

  if (!words.length) return { ok: false, error: 'คำต้องมีอย่างน้อย 2 ช่อง' };

  const isNew = (r, c) => placements.some((p) => p.r === r && p.c === c);
  let total = 0;
  const detail = [];
  for (const cells of words) {
    const text = cells.map(([r, c]) => cellText(next[r][c])).join('');
    if (!dict.has(text)) {
      return { ok: false, error: `ไม่พบคำ "${text}" ในพจนานุกรม`, words: detail, badWord: text };
    }
    let wm = 1, sum = 0;
    for (const [r, c] of cells) {
      const cell = next[r][c];
      const base = cell.blank ? 0 : (tileValue(cell.t) || 1);
      const m = isNew(r, c) ? multOf(layout, r, c) : { word: 1, letter: 1 };
      sum += base * m.letter;
      wm *= m.word;
    }
    detail.push({ text, score: sum * wm, cells });
    total += sum * wm;
  }

  const bonus = BINGO[placements.length] || 0;
  return { ok: true, words: detail, total: total + bonus, bingo: bonus, board: next };
}

/** ยกคำเก่าออก เหลือเฉพาะเบี้ยของคำล่าสุด */
export function liftOld(board, words) {
  const keep = new Set();
  for (const w of words) for (const [r, c] of (w.cells || w)) keep.add(`${r},${c}`);
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
        bag.push({ t: a, marks: '', value: meta.value, pair: [a, b], blank: false });
      } else if (name === 'ตัวว่าง') {
        bag.push({ t: '?', marks: '', value: 0, blank: true });
      } else {
        bag.push({ t: name, marks: '', value: meta.value, blank: false });
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

/** ฟังก์ชันค่าตัวอักษร (รองรับเบี้ยคู่) */
export function makeTileValue(tiles) {
  return (ch) => {
    if (tiles[ch]) return tiles[ch].value;
    const pair = Object.keys(tiles).find((k) => k.includes('/') && k.split('/').includes(ch));
    return pair ? tiles[pair].value : 1;
  };
}
