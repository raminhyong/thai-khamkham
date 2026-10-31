import { readFileSync } from 'node:fs';
import { emptyBoard, makeBag, draw, validateMove, liftOld, makeTileValue } from '../js/rules.mjs';
import { botMove } from '../js/bot.mjs';

const dictData = JSON.parse(readFileSync(new URL('../data/dict.json', import.meta.url)));
const tilesData = JSON.parse(readFileSync(new URL('../data/tiles.json', import.meta.url)));
const layout = JSON.parse(readFileSync(new URL('../data/board.json', import.meta.url))).cells;

const dict = new Set(dictData.words);
const tileValue = makeTileValue(tilesData.tiles);

for (const level of ['easy', 'medium', 'hard']) {
  let board = emptyBoard();
  const bag = makeBag(tilesData.tiles);
  const rack = draw(bag, []);
  const t0 = Date.now();
  let total = 0;
  let moves = 0;

  for (let turn = 0; turn < 4; turn++) {
    const mv = botMove({ board, layout, rack, dict, tileValue, level });
    if (!mv) { console.log(`  ${level}: ไม่มีตาเดินในตาที่ ${turn + 1}`); break; }
    const res = validateMove({ board, layout, placements: mv.placements, dict, tileValue });
    if (!res.ok) throw new Error(`บอทเล่นผิดกติกา: ${res.error}`);
    board = liftOld(res.board, res.words);
    total += res.total;
    moves++;
    // คืนเบี้ยที่ใช้ แล้วจับใหม่
    const used = mv.placements.length;
    for (let i = 0; i < used; i++) rack.shift();
    draw(bag, rack);
  }
  console.log(`${level.padEnd(6)} → ${moves} ตา · ${total} คะแนน · ${Date.now() - t0} ms`);
}
console.log('✅ บอทเล่นได้ตามกติกา');
