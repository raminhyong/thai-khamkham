// Worker: ห้องเล่นคำคม 2 เครื่อง (Durable Object per room)
// - POST /api/room            → สร้างห้อง คืน { code }
// - GET  /api/room/:code/ws   → WebSocket เข้าห้อง
import { DurableObject } from 'cloudflare:workers';
import dictData from '../data/dict.json';
import tilesData from '../data/tiles.json';
import boardData from '../data/board.json';
import {
  emptyBoard, validateMove, liftOld, makeBag, draw, rackValue, makeTileValue,
  RACK_SIZE, CENTER,
} from '../js/rules.mjs';

const DICT = new Set(dictData.words);
const TILES = tilesData.tiles;
const LAYOUT = boardData.cells;
const TILE_VALUE = makeTileValue(TILES);
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const newCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sessions = new Map(); // playerId → WebSocket
    this.state = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.state = (await this.ctx.storage.get('state')) || null;
    });
  }

  async save() {
    await this.ctx.storage.put('state', this.state);
  }

  publicView() {
    if (!this.state) return null;
    return {
      code: this.state.code,
      status: this.state.status,
      checkMode: this.state.checkMode,
      turn: this.state.turn,
      board: this.state.board,
      scores: this.state.players.map((p) => p.score),
      names: this.state.players.map((p) => p.name),
      ids: this.state.players.map((p) => p.id),
      bagCount: this.state.bag.length,
      passes: this.state.passes,
      log: this.state.log.slice(-30),
      lastMove: this.state.lastMove,
    };
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  }

  broadcast() {
    const view = this.publicView();
    for (const [pid, ws] of this.sessions) {
      this.send(ws, { type: 'state', view, you: pid, rack: this.state?.players.find((p) => p.id === pid)?.rack || [] });
    }
  }

  initRoom(code, checkMode) {
    this.state = {
      code,
      checkMode: checkMode === 'challenge' ? 'challenge' : 'auto',
      status: 'waiting',
      players: [],
      board: emptyBoard(),
      bag: [],
      turn: 0,
      passes: 0,
      log: [],
      lastMove: null,
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init') {
      const code = url.searchParams.get('code') || newCode();
      this.initRoom(code, url.searchParams.get('check'));
      await this.save();
      return Response.json({ code });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    let playerId = null;

    server.addEventListener('message', async (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      try {
        await this.handle(msg, server, (id) => { playerId = id; });
      } catch (e) {
        this.send(server, { type: 'error', message: String(e.message || e) });
      }
    });

    server.addEventListener('close', () => {
      if (playerId) this.sessions.delete(playerId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handle(msg, ws, setPlayer) {
    if (!this.state) this.initRoom(newCode(), msg.checkMode);

    if (msg.type === 'join') {
      let player = this.state.players.find((p) => p.id === msg.playerId);
      if (!player) {
        if (this.state.players.length >= 2) return this.send(ws, { type: 'error', message: 'ห้องเต็มแล้ว' });
        player = {
          id: crypto.randomUUID(),
          name: (msg.name || 'ผู้เล่น').slice(0, 20),
          score: 0,
          rack: [],
        };
        this.state.players.push(player);
      }
      setPlayer(player.id);
      this.sessions.set(player.id, ws);
      this.send(ws, { type: 'joined', playerId: player.id, view: this.publicView(), rack: player.rack });
      this.broadcast();
      await this.save();
      return;
    }

    const me = this.state.players.find((p) => this.sessions.get(p.id) === ws);
    if (!me) return this.send(ws, { type: 'error', message: 'ยังไม่ได้เข้าห้อง' });
    const idx = this.state.players.indexOf(me);

    if (msg.type === 'start') {
      if (this.state.players.length < 2) return this.send(ws, { type: 'error', message: 'ต้องมีผู้เล่น 2 คน' });
      this.state.bag = makeBag(TILES);
      this.state.players.forEach((p) => { p.rack = []; draw(this.state.bag, p.rack); });
      this.state.board = emptyBoard();
      this.state.turn = 0;
      this.state.status = 'playing';
      this.state.log = [];
      this.state.passes = 0;
      this.state.players.forEach((p) => { p.score = 0; });
      this.broadcast();
      await this.save();
      return;
    }

    if (this.state.status !== 'playing') return;
    if (idx !== this.state.turn) return this.send(ws, { type: 'error', message: 'ยังไม่ถึงตาคุณ' });

    if (msg.type === 'move') {
      const res = validateMove({
        board: this.state.board, layout: LAYOUT, placements: msg.placements,
        dict: DICT, tileValue: TILE_VALUE,
      });
      if (!res.ok) return this.send(ws, { type: 'error', message: res.error });

      // เอาเบี้ยที่ใช้ ออกจากมือผู้เล่น
      for (const p of msg.placements) {
        const i = me.rack.findIndex((t) => (p.blank ? t.blank : (t.pair ? t.pair.includes(p.t) : t.t === p.t)));
        if (i < 0) return this.send(ws, { type: 'error', message: 'เบี้ยในมือไม่ตรง' });
        me.rack.splice(i, 1);
      }

      this.state.board = liftOld(res.board, res.words);
      me.score += res.total;
      draw(this.state.bag, me.rack);
      this.state.log.push({ player: idx, words: res.words.map((w) => w.text), score: res.total });
      this.state.lastMove = { player: idx, placements: msg.placements, words: res.words.map((w) => w.text) };
      this.state.passes = 0;
      this.state.turn = 1 - idx;
      this.checkEnd(idx);
      this.broadcast();
      await this.save();
      return;
    }

    if (msg.type === 'pass') {
      this.state.passes += 1;
      this.state.turn = 1 - idx;
      if (this.state.bag.length > 0 && this.state.passes >= 4) {
        this.state.board = emptyBoard();
        this.state.passes = 0;
      }
      this.broadcast();
      await this.save();
      return;
    }

    if (msg.type === 'exchange') {
      if (this.state.bag.length < 9) return this.send(ws, { type: 'error', message: 'ในถุงเหลือน้อยกว่า 9 ตัว' });
      const i = me.rack.findIndex((t) => t.t === msg.tile);
      if (i < 0) return this.send(ws, { type: 'error', message: 'ไม่พบเบี้ยนั้น' });
      const out = me.rack.splice(i, 1)[0];
      this.state.bag.unshift(out);
      draw(this.state.bag, me.rack);
      this.state.turn = 1 - idx;
      this.broadcast();
      await this.save();
      return;
    }
  }

  checkEnd(justPlayed) {
    const bagEmpty = this.state.bag.length === 0;
    if (bagEmpty && this.state.players[justPlayed].rack.length === 0) {
      const other = this.state.players[1 - justPlayed];
      this.state.players[justPlayed].score += rackValue(other.rack) * 2;
      this.state.status = 'finished';
      return;
    }
    if (bagEmpty && this.state.passes >= 6) {
      this.state.players.forEach((p) => { p.score -= rackValue(p.rack); });
      this.state.status = 'finished';
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (url.pathname === '/api/room' && request.method === 'POST') {
      const code = newCode();
      const check = url.searchParams.get('check') || 'auto';
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      await stub.fetch(`https://do/init?code=${code}&check=${check}`);
      return Response.json({ code }, { headers: cors });
    }

    const m = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4,8})\/ws$/);
    if (m) {
      const id = env.ROOMS.idFromName(m[1]);
      return env.ROOMS.get(id).fetch(request);
    }

    return new Response('คำคม room service', { headers: cors });
  },
};
