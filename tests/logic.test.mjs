import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { ROWS, COLS, CENTER, emptyBoard, validateMove, liftOld, cellText, BINGO } from '../js/rules.mjs';

const layout = JSON.parse(readFileSync(new URL('../data/board.json', import.meta.url))).cells;
const tiles = JSON.parse(readFileSync(new URL('../data/tiles.json', import.meta.url))).tiles;
const tileValue = (ch) => tiles[ch]?.value ?? 1;
const dict = new Set(['มา', 'ดี', 'กขคงจฉ']);
const [cr, cc] = CENTER;

// 1) ผังกระดาน: 9 แถว x 15 คอลัมน์ = 135 ช่อง
assert.equal(layout.length, ROWS);
assert.ok(layout.every((r) => r.length === COLS));
assert.equal(ROWS * COLS, 135);

// 2) ตาแรกผ่านดาวกลาง → ผ่าน (ดาวกลางเป็น W2 = x2 คำ)
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc - 1, c_: 'ม' }, { r: cr, c: cc, c_: 'า' },
  ]});
  assert.equal(res.ok, true, res.error);
  assert.equal(res.words[0].text, 'มา');
  assert.equal(res.total, 4, 'ได้ ' + res.total);
}

// 3) ตาแรกไม่ผ่านกลาง → ปฏิเสธ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: 0, c: 0, c_: 'ม' }, { r: 0, c: 1, c_: 'า' },
  ]});
  assert.equal(res.ok, false);
  assert.match(res.error, /ดาวกลาง/);
}

// 4) คำไม่อยู่ในพจนานุกรม → ปฏิเสธ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc - 1, c_: 'ด' }, { r: cr, c: cc, c_: 'า' },
  ]});
  assert.equal(res.ok, false);
  assert.match(res.error, /ไม่พบคำ/);
}

// 5) วางไม่ติดกัน → ปฏิเสธ
{
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue, placements: [
    { r: cr, c: cc, c_: 'ม' }, { r: cr, c: cc + 2, c_: 'า' },
  ]});
  assert.equal(res.ok, false);
  assert.match(res.error, /ติดกัน/);
}

// 6) ยกคำเก่า: เหลือเฉพาะเบี้ยของคำล่าสุด
{
  const b = emptyBoard();
  b[cr][cc - 1] = { c: 'ม' };
  b[cr][cc] = { c: 'า' };
  const kept = liftOld(b, [{ cells: [[cr, cc]] }]);
  assert.equal(kept[cr][cc].c, 'า');
  assert.equal(kept[cr][cc - 1], null);
}

// 7) โบนัสบิงโก 6-9 ตัว
assert.deepEqual(BINGO, { 6: 40, 7: 50, 8: 70, 9: 90 });
{
  const word = 'กขคงจฉ';
  const res = validateMove({ board: emptyBoard(), layout, dict, tileValue,
    placements: [...word].map((ch, i) => ({ r: cr, c: i + 4, c_: ch })) });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.bingo, 40);
}

// 8) cellText: สระหน้า/หลัง/วรรณยุกต์
assert.equal(cellText({ c: 'ก', v: 'า' }), 'กา');
assert.equal(cellText({ c: 'ก', v: 'เ' }), 'เก');
assert.equal(cellText({ c: 'ก', v: 'ี', t: '้' }), 'กี้');

console.log('✅ ผ่านทั้ง 8 เทสต์ (กระดาน 15x9 · ยกคำเก่า · บิงโก 40/50/70/90)');
