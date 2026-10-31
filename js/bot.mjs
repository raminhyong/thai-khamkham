// บอทคำคม 3 ระดับ — คิดในเครื่องผู้เล่น ใช้ validateMove เป็นตัวตัดสิน
import { ROWS, COLS, CENTER, PAPER, cellText, validateMove, inBounds } from './rules.mjs';

const PAPER_SET = new Set(PAPER);

/** แยกคำเป็นเบี้ย: ตัวอักษรปกติ = 1 เบี้ย · สระบน-ล่าง/วรรณยุกต์ = ไม้ของเบี้ยก่อนหน้า */
export function splitWord(word) {
  const out = [];
  for (const ch of word) {
    if (PAPER_SET.has(ch) && out.length) out[out.length - 1].marks += ch;
    else out.push({ t: ch, marks: '' });
  }
  return out;
}

const signature = (word) => splitWord(word).map((s) => s.t).sort().join('');

let WORD_INDEX = null;
function buildIndex(dict) {
  if (WORD_INDEX) return WORD_INDEX;
  const map = new Map(); // signature → [word]
  for (const w of dict) {
    if (w.length < 2 || w.length > 12) continue;
    const specs = splitWord(w);
    if (specs.length < 2 || specs.length > 9) continue;
    const sig = specs.map((s) => s.t).sort().join('');
    if (!map.has(sig)) map.set(sig, []);
    map.get(sig).push(w);
  }
  WORD_INDEX = map;
  return map;
}

/** คำที่組成ได้จากเบี้ยในมือ (นับเบี้ยคู่/blank ด้วย) */
export function candidates(rack, dict) {
  const counts = new Map();
  let blanks = 0;
  for (const tile of rack) {
    if (tile.blank) { blanks++; continue; }
    for (const c of new Set(tile.pair || [tile.t])) {
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
  const index = buildIndex(dict);
  const out = [];
  for (const [sig, list] of index) {
    // เช็คว่า sig ประกอบได้จาก rack (นับรวมทุกตัว)
    const need = new Map();
    for (const ch of sig) need.set(ch, (need.get(ch) || 0) + 1);
    let short = 0;
    let ok = true;
    for (const [ch, n] of need) {
      const have = counts.get(ch) || 0;
      if (have < n) short += n - have;
    }
    if (short > blanks) ok = false;
    if (ok) out.push(...list);
  }
  return out;
}

/** หาตำแหน่งวางที่เป็นไปได้ทั้งหมดของคำหนึ่งคำ */
export function placementsFor(word, { board, layout, dict, tileValue }) {
  const specs = splitWord(word);
  const k = specs.length;
  if (k > 9) return [];
  const empty = board.every((row) => row.every((c) => !c));
  const results = [];

  const dirs = [[0, 1], [1, 0]];
  for (const [dr, dc] of dirs) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const er = r + dr * (k - 1);
        const ec = c + dc * (k - 1);
        if (!inBounds(er, ec)) continue;

        let overlaps = 0;
        let fits = true;
        const parts = [];
        for (let i = 0; i < k; i++) {
          const rr = r + dr * i, cc = c + dc * i;
          const cell = board[rr][cc];
          const spec = specs[i];
          if (cell) {
            if (cellText(cell) !== spec.t + spec.marks) { fits = false; break; }
            overlaps++;
          } else {
            parts.push({ r: rr, c: cc, t: spec.t, marks: spec.marks });
          }
        }
        if (!fits || !parts.length) continue;
        if (empty) {
          const covers = parts.some((p) => p.r === CENTER[0] && p.c === CENTER[1]);
          if (!covers) continue;
        } else if (overlaps === 0) continue;

        const res = validateMove({ board, layout, placements: parts, dict, tileValue });
        if (res.ok) results.push({ word, placements: parts, score: res.total, words: res.words });
      }
    }
  }
  return results;
}

/**
 * เลือกตาเดินของบอท
 * level: 'easy' | 'medium' | 'hard'
 */
export function botMove({ board, layout, rack, dict, tileValue, level = 'medium' }) {
  const words = candidates(rack, dict);
  if (!words.length) return null;

  // สุ่มลำดับเพื่อไม่ให้บอทเล่นซ้ำเดิมทุกเกม
  const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, 400);
  const moves = [];
  for (const w of shuffled) {
    moves.push(...placementsFor(w, { board, layout, dict, tileValue }));
    if (moves.length > 120 && level !== 'hard') break;
  }
  if (!moves.length) return null;

  moves.sort((a, b) => b.score - a.score);

  if (level === 'hard') return moves[0];

  if (level === 'easy') {
    // ง่าย: เน้นคำสั้น คะแนนน้อย (แต่เป็นคำที่ถูกต้อง)
    const simple = moves.filter((m) => m.placements.length <= 3);
    const pool = simple.length ? simple : moves;
    pool.sort((a, b) => a.score - b.score);
    return pool[Math.floor(Math.random() * Math.min(pool.length, 5))];
  }

  // กลาง: สุ่มจากครึ่งบนของคะแนน
  const top = moves.slice(0, Math.max(1, Math.ceil(moves.length / 2)));
  return top[Math.floor(Math.random() * top.length)];
}
