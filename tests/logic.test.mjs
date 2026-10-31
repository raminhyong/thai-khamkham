import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { ROWS, COLS, CENTER, emptyBoard, validateMove, liftOld, cellText, BINGO } from '../js/rules.mjs';

const layout = JSON.parse(readFileSync(new URL('../data/board.json', import.meta.url))).cells;
const tiles = JSON.parse(readFileSync(new URL('../data/tiles.json', import.meta.url))).tiles;
const tileValue = (ch) => tiles[ch]?.value ?? 1;
const dict = new Set(['มา', 'ดี', 'กขคงจฉ', 'จฉ']);
const [cr, cc] = CENTER;

// 1) ผังกระดาน 9x15 = 135 ช่อง
assert.equal(layout.length, ROWS);
assert.ok(layout.every((r) => r.length === COLS));
assert.equal(ROWS * COLS, 135);

// 2) ตาแรกผ่านดาวกลาง (W2 ×2 คำ)
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc - 1, t: 'ม' }, { r: cr, c: cc, t: 'า' },
  ]});
  assert.equal(res.ok, true, res.error);
  assert.equal(res.words[0].text, 'มา');
  assert.equal(res.total, 4, 'ได้ ' + res.total);
}

// 3) ตาแรกไม่ผ่านกลาง → ปฏิเสธ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: 0, c: 0, t: 'ม' }, { r: 0, c: 1, t: 'า' },
  ]});
  assert.equal(res.ok, false);
  assert.match(res.error, /ดาวกลาง/);
}

// 4) คำไม่อยู่ในพจนานุกรม → ปฏิเสธ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc - 1, t: 'ด' }, { r: cr, c: cc, t: 'า' },
  ]});
  assert.equal(res.ok, false);
  assert.match(res.error, /ไม่พบคำ/);
}

// 5) วางไม่ติดกัน → ปฏิเสธ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc, t: 'ม' }, { r: cr, c: cc + 2, t: 'า' },
  ]});
  assert.equal(res.ok, false);
  assert.match(res.error, /ติดกัน/);
}

// 6) ยกคำเก่า: เหลือเฉพาะเบี้ยของคำล่าสุด
{
  const b = emptyBoard();
  b[cr][cc - 1] = { t: 'ม', marks: '' };
  b[cr][cc] = { t: 'า', marks: '' };
  const kept = liftOld(b, [{ cells: [[cr, cc]] }]);
  assert.equal(kept[cr][cc].t, 'า');
  assert.equal(kept[cr][cc - 1], null);
}

// 7) โบนัสบิงโก 6-9
assert.deepEqual(BINGO, { 6: 40, 7: 50, 8: 70, 9: 90 });
{
  const word = 'กขคงจฉ';
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue,
    placements: [...word].map((ch, i) => ({ r: cr, c: i + 4, t: ch })) });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.bingo, 40);
}

// 8) เบี้ยกระดาษ (marks) ไม่มีคะแนน แต่รวมอยู่ในคำ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc - 1, t: 'ด' }, { r: cr, c: cc, t: 'ี', marks: '' },
  ]});
  // ดี = ด + ี (ี เป็นเบี้ยกระดาษ ต้องเกาะ ด) — ถ้าวางเป็นคนละช่องจะไม่ตรงคำ
  assert.equal(res.ok, false);
}
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc - 1, t: 'ด', marks: 'ี' }, { r: cr, c: cc, t: '?' , blank: true},
  ]});
  assert.equal(res.ok, false, 'ต้องไม่ผ่านเพราะมี ★ เกินมา');
}
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc, t: 'ด', marks: 'ี' },
  ]});
  assert.equal(res.ok, false, 'คำเดียวความยาว 1 ไม่ผ่าน');
}

console.log('✅ ผ่านทั้ง 8 กลุ่มเทสต์ (กระดาน 15x9 · marks · ยกคำเก่า · บิงโก)');
