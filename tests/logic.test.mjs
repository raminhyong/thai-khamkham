import assert from 'node:assert';
import { emptyBoard, validateMove, cellText, SIZE } from '../js/rules.mjs';

const val = () => 1;
const mid = Math.floor(SIZE / 2);

// 1) ตาแรกผ่านช่องดาวกลาง → ผ่าน
{
  const board = emptyBoard();
  const res = validateMove(board, [
    { r: mid, c: mid - 1, c_: 'ม' },
    { r: mid, c: mid, c_: 'า' },
  ], new Set(['มา']), val);
  assert.equal(res.ok, true, res.error);
  assert.equal(res.words[0].text, 'มา');
  assert.equal(res.total, 2 * 2, 'ดาวกลางต้องคูณ 2: ' + res.total);
}

// 2) ตาแรกไม่ผ่านกลาง → ปฏิเสธ
{
  const res = validateMove(emptyBoard(), [
    { r: 0, c: 0, c_: 'ม' }, { r: 0, c: 1, c_: 'า' },
  ], new Set(['มา']), val);
  assert.equal(res.ok, false);
  assert.match(res.error, /ดาวกลาง/);
}

// 3) คำไม่อยู่ในพจนานุกรม → ปฏิเสธ
{
  const res = validateMove(emptyBoard(), [
    { r: mid, c: mid - 1, c_: 'ม' }, { r: mid, c: mid, c_: 'า' },
  ], new Set(['ดี']), val);
  assert.equal(res.ok, false);
  assert.match(res.error, /ไม่พบคำ/);
}

// 4) วางไม่ติดกัน → ปฏิเสธ
{
  const res = validateMove(emptyBoard(), [
    { r: mid, c: mid, c_: 'ม' }, { r: mid, c: mid + 2, c_: 'า' },
  ], new Set(['มา']), val);
  assert.equal(res.ok, false);
  assert.match(res.error, /ติดกัน/);
}

// 5) ตาที่สองต่อกับเบี้ยเดิม + คำตัดขวางต้องถูกต้อง
{
  const board = emptyBoard();
  board[mid][mid] = { c: 'ม', v: '', t: '' };
  board[mid][mid + 1] = { c: 'า', v: '', t: '' };  // "มา"
  const res = validateMove(board, [
    { r: mid - 1, c: mid, c_: 'ดี'[0] }, // ด
    { r: mid - 2, c: mid, c_: 'ี' },
  ], new Set(['มา', 'ดี']), val);
  assert.equal(res.ok, false, 'ควรปฏิเสธเพราะ ดี ต้องมี ด + ี ในช่องเดียว');
}

// 6) cellText ประกอบสระหน้า/หลังถูกต้อง
{
  assert.equal(cellText({ c: 'ก', v: 'า', t: '' }), 'กา');
  assert.equal(cellText({ c: 'ก', v: 'เ', t: '' }), 'เก');
  assert.equal(cellText({ c: 'ก', v: 'ี', t: '้' }), 'กี้');
}

// 7) บิงโก: ใช้ 9 ตัว → +50
{
  const board = emptyBoard();
  const word = 'กขคงจฉชซญ';
  const placements = [...word].map((ch, i) => ({ r: mid, c: i + 1, c_: ch }));
  const res = validateMove(board, placements, new Set([word]), val);
  assert.equal(res.ok, true, res.error);
  assert.ok(res.total >= 50, 'ต้องได้โบนัสบิงโก');
}

console.log('✅ ผ่านทั้ง 7 เทสต์');
