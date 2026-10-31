// ชั้นเชื่อมต่อห้องออนไลน์ (Worker + Durable Object)
export const NET_BASE = 'https://khamkham-room.raminhyong.workers.dev';

export class Net {
  constructor({ onState, onJoined, onError, onStatus }) {
    this.ws = null;
    this.playerId = null;
    this.code = null;
    this.handlers = { onState, onJoined, onError, onStatus };
  }

  get active() { return !!this.ws; }

  async create(checkMode = 'auto') {
    const r = await fetch(`${NET_BASE}/api/room?check=${checkMode}`, { method: 'POST' });
    if (!r.ok) throw new Error('สร้างห้องไม่สำเร็จ');
    const { code } = await r.json();
    await this.connect(code);
    return code;
  }

  connect(code) {
    this.code = code;
    const url = `${NET_BASE.replace('https', 'wss')}/api/room/${code}/ws`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        const saved = localStorage.getItem('kk_playerId');
        ws.send(JSON.stringify({
          type: 'join',
          name: localStorage.getItem('kk_name') || 'ผู้เล่น',
          playerId: saved || undefined,
        }));
        this.handlers.onStatus?.('connected');
        resolve();
      };
      ws.onerror = (e) => {
        this.handlers.onError?.('เชื่อมต่อห้องไม่สำเร็จ');
        reject(e);
      };
      ws.onclose = () => { this.handlers.onStatus?.('closed'); };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'joined') {
          this.playerId = m.playerId;
          localStorage.setItem('kk_playerId', m.playerId);
          this.handlers.onJoined?.(m);
        } else if (m.type === 'state') {
          this.handlers.onState?.(m);
        } else if (m.type === 'error') {
          this.handlers.onError?.(m.message);
        }
      };
    });
  }

  send(msg) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  start() { this.send({ type: 'start' }); }
  move(placements) { this.send({ type: 'move', placements }); }
  pass() { this.send({ type: 'pass' }); }
  exchange(tile) { this.send({ type: 'exchange', tile }); }
  close() { this.ws?.close(); this.ws = null; }
}
