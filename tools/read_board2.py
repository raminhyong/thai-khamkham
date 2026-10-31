#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""อ่านผังกระดานคำคมจริงจากภาพ: 15 คอลัมน์ x 9 แถว (+ แถบสระ 10 แถบ)

เรขาคณิตที่วัดได้จากภาพ (refs/Board.png):
  x0..x1 = 12..1011 (1000 px) → 15 คอลัมน์ × ~66.7 px
  y0..y1 = 43..999 (956 px)  → 9 แถว × 64 px + 10 แถบสระ × ~38 px (pitch ~102)
"""
from __future__ import annotations

import json

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
px = im.load()
COLS, ROWS = 15, 9
x0, x1 = 12, 1012
y0, y1 = 43, 999
cell_w = (x1 - x0) / COLS
strip_h = (y1 - y0) / (ROWS + 1) * 0.37      # แถบสระกินสัดส่วนนี้ของ pitch
pitch = (y1 - y0) / ROWS


def avg(cx, cy, half=18):
    vals = []
    for y in range(int(cy - half), int(cy + half), 2):
        for x in range(int(cx - half), int(cx + half), 2):
            if 0 <= x < im.width and 0 <= y < im.height:
                vals.append(px[x, y])
    if not vals:
        return (0, 0, 0)
    return tuple(sum(v[i] for v in vals) // len(vals) for i in range(3))


def classify(rgb):
    r, g, b = rgb
    if r > 215 and g > 215 and b > 215:
        return "normal"
    if r > 170 and g > 120 and b > 110 and b > g - 20 and r > g:      # ชมพู
        return "W2" if r > 200 else "W2"
    if r > 150 and g < 110 and b < 110:
        return "W3"                                                      # แดง
    if b > 150 and b > r and b > g:
        return "L2"                                                      # ฟ้า
    if r > 190 and g > 110 and b < 100:
        return "L4"                                                      # ส้ม
    if r > 110 and b > 130 and b > g:
        return "L5"                                                      # ม่วง
    if g > 110 and r < 90:
        return "L3" if g > 140 else "normal"                             # เขียวเข้ม
    if g > 90:
        return "normal"
    return "?"


print("ตัวอย่างสีกลางช่อง (hex):")
grid = []
for r in range(ROWS):
    cy = y0 + pitch * r + strip_h + cell_w / 2
    row = []
    for c in range(COLS):
        cx = x0 + cell_w * (c + 0.5)
        rgb = avg(cx, cy)
        row.append((classify(rgb), rgb))
    grid.append(row)

for r, row in enumerate(grid):
    print(f"แถว {r+1:2}: ", " ".join(f"{t:>6}" for t, _ in row))
print("\nhex ตัวอย่างแถว 1:", [f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}" for _, rgb in grid[0]])
print("hex ตัวอย่างแถว 5:", [f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}" for _, rgb in grid[4]])

from collections import Counter
print("\nสรุป:", dict(Counter(t for row in grid for t, _ in row)))
