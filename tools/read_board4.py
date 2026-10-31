#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""อ่านผังกระดานแบบแม่นยำ: ใช้ 'มีตัวอักษรสีขาวในช่องไหม' แยกช่องพิเศษออกจากช่องปกติ

เหตุผล: ช่องปกติ = เขียวล้วน ไม่มีข้อความ · ช่องพิเศษ = มีข้อความสีขาว
จึงไม่ต้องพึ่งเฉดเขียวที่ใกล้กันมาก
"""
from __future__ import annotations

import json
from collections import Counter

from PIL import Image

SRC = "/home/hermes/projects/thai-khamkham/refs/Board.png"
im = Image.open(SRC).convert("RGB")
px = im.load()
W, H = im.size

# --- 1) หาแถบเหลืองแนวนอน (ช่องสระ) เพื่อใช้เป็นเส้นฐานของแถว
def yellowish(rgb):
    r, g, b = rgb
    return r > 165 and g > 135 and b < 140


prof = []
for y in range(H):
    n = sum(1 for x in range(20, W - 20, 6) if yellowish(px[x, y]))
    prof.append(n)

thr = max(prof) * 0.45
bands, cur = [], []
for y, v in enumerate(prof):
    if v >= thr:
        cur.append(y)
    else:
        if cur:
            bands.append((cur[0], cur[-1]))
            cur = []
if cur:
    bands.append((cur[0], cur[-1]))
bands = [b for b in bands if b[1] - b[0] >= 8]
print("แถบสระ (y):", len(bands), bands)

# --- 2) ขอบซ้าย/ขวาของพื้นที่เล่น
xs = [x for x in range(W) if any(yellowish(px[x, y]) for y in range(40, H - 40, 4))]
x0, x1 = min(xs), max(xs)
print("ขอบ x:", x0, x1)

COLS = 15
cw = (x1 - x0 + 1) / COLS


def cell_stats(c, ya, yb):
    xa = int(x0 + cw * c + cw * 0.12)
    xb = int(x0 + cw * (c + 1) - cw * 0.12)
    ya2 = int(ya + (yb - ya) * 0.12)
    yb2 = int(yb - (yb - ya) * 0.12)
    white = 0
    total = 0
    hues = Counter()
    for y in range(ya2, yb2, 2):
        for x in range(xa, xb, 2):
            r, g, b = px[x, y]
            total += 1
            if r > 200 and g > 200 and b > 200:
                white += 1
            else:
                hues[(r // 32, g // 32, b // 32)] += 1
    dom = hues.most_common(1)[0][0] if hues else (0, 0, 0)
    return white / max(total, 1), (dom[0] * 32, dom[1] * 32, dom[2] * 32)


def label(hue, has_text):
    r, g, b = hue
    if not has_text:
        return "n"
    if r > 96 and g < 96 and b < 96:
        return "W3"
    if r > 128 and b > 96 and g < 128:
        return "W2"
    if b > 96 and b >= g and b >= r:
        return "L2"
    if r > 128 and 64 <= g <= 160 and b < 96:
        return "L4"
    if r > 64 and b > 96 and g < 96:
        return "L5"
    return "L3"


grid = []
for i in range(len(bands) - 1):
    ya, yb = bands[i][1], bands[i + 1][0]
    if yb - ya < 40:
        continue
    row = []
    for c in range(COLS):
        frac, hue = cell_stats(c, ya, yb)
        row.append(label(hue, frac > 0.06))
    grid.append(row)

print(f"\nอ่านได้ {len(grid)} แถว x {COLS} คอลัมน์")
for i, row in enumerate(grid):
    print(f"R{i+1}: " + " ".join(f"{v:>2}" for v in row))
print("\nสรุป:", dict(Counter(v for r in grid for v in r)))
json.dump(grid, open("/home/hermes/projects/thai-khamkham/data/board_raw.json", "w"), ensure_ascii=False, indent=1)
