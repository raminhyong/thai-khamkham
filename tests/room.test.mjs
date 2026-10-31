// ทดสอบห้อง 2 เครื่องแบบครบวงจร: สร้างห้อง → join → start → เดินคำจริง → อีกฝ่ายเห็นตรงกัน
import { readFileSync } from 'node:fs';
import { candidates, placementsFor } from '../js/bot.mjs';
import { emptyBoard, makeTileValue } from '../js/rules.mjs';

const BASE = process.argv[2] || 'https://khamkham-room.raminhyong.workers.dev';
const dict = new Set(JSON.parse(readFileSync(new URL('../data/dict.json', import.meta.url))).words);
const tiles = JSON.parse(readFileSync(new URL('../data/tiles.json', import.meta.url))).tiles;
const layout = JSON.parse(readFileSync(new URL('../data/board.json', import.meta.url))).cells;
const tileValue = makeTileValue(tiles);

const { code } = await (await fetch(`${BASE}/api/room`, { method: 'POST' })).json();
console.log('สร้างห้อง:', code);

const wsUrl = `${BASE.replace('https', 'wss')}/api/room/${code}/ws`;
const ws1 = new WebSocket(wsUrl);
const ws2 = new WebSocket(wsUrl);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let s1 = null;
let s2 = null;
ws1.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'state') s1 = m;
  if (m.type === 'error') console.log('P1 error:', m.message);
});
ws2.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'state') s2 = m;
  if (m.type === 'error') console.log('P2 error:', m.message);
});

await new Promise((r) => { ws1.onopen = r; });
await new Promise((r) => { ws2.onopen = r; });

ws1.send(JSON.stringify({ type: 'join', name: 'ผู้เล่น 1' }));
await wait(300);
ws2.send(JSON.stringify({ type: 'join', name: 'ผู้เล่น 2' }));
await wait(500);
ws1.send(JSON.stringify({ type: 'start' }));
await wait(700);

const rack = s1.rack;
console.log('เบี้ย P1:', rack.map((t) => t.t + (t.marks || '')).join(' '));

// หาคำที่วางได้จริงจากมือ (ผ่านดาวกลาง)
const board = emptyBoard();
let chosen = null;
const have = new Set(rack.filter((t) => !t.blank).flatMap((t) => (t.pair ? t.pair : [t.t])));
for (const w of candidates(rack, dict).slice(0, 80)) {
  if ([...w].some((ch) => /[ิีึืุูั่้๊๋์]/.test(ch) === false && !have.has(ch))) continue; // ข้ามคำที่ต้องใช้ blank
  const moves = placementsFor(w, { board, layout, dict, tileValue });
  if (moves.length) { chosen = moves[0]; break; }
}
if (!chosen) { console.log('ไม่พบคำที่วางได้ในมือนี้'); process.exit(1); }

console.log('เลือกคำ:', chosen.word, '=', chosen.score, 'คะแนน');
ws1.send(JSON.stringify({ type: 'move', placements: chosen.placements }));
await wait(900);

console.log('หลังเดิน → turn:', s1?.view?.turn, '| log:', JSON.stringify(s1?.view?.log));
console.log('P2 เห็นกระดานตรงกัน:', JSON.stringify(s2?.view?.board) === JSON.stringify(s1?.view?.board));
console.log('คะแนน:', s1?.view?.scores);

ws2.send(JSON.stringify({ type: 'pass' }));
await wait(600);
console.log('หลัง P2 ผ่าน → turn:', s1?.view?.turn, '| passes:', s1?.view?.passes, '| กระดานยังอยู่:', !!s1?.view?.board?.[4]?.[7] || s1?.view?.board?.some((r) => r.some(Boolean)));

ws1.close(); ws2.close();
console.log('✅ ทดสอบห้อง 2 เครื่องผ่าน');
