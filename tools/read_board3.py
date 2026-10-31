#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""อ่านผังกระดาน 15x9 ด้วย 'สีที่พบบ่อยที่สุด' ในแต่ละช่อง แล้วเทียบกับผลอ่านด้วยตา"""
from __future__ import annotations

from collections import Counter

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
px = im.load()
X0, X1, Y0, Y1 = 12, 1012, 43, 999
COLS, ROWS = 15, 9
cw = (X1 - X0) / COLS
pitch = (Y1 - Y0) / ROWS
STRIP = 34          # ความสูงแถบสระ (px) ที่วัดได้


def cell_mode(c, r):
    xa = int(X0 + cw * c + 8)
    xb = int(X0 + cw * (c + 1) - 8)
    ya = int(Y0 + pitch * r + STRIP + 6)
    yb = int(Y0 + pitch * r + pitch - 6)
    cnt = Counter()
    for y in range(ya, yb, 2):
        for x in range(xa, xb, 2):
            if 0 <= x < im.width and 0 <= y < im.height:
                rr, gg, bb = px[x, y]
                cnt[(rr // 24 * 24, gg // 24 * 24, bb // 24 * 24)] += 1
    return cnt.most_common(1)[0][0] if cnt else (0, 0, 0)


def classify(rgb):
    r, g, b = rgb
    if r >= 120 and g <= 96 and b <= 96:
        return "W3"
    if r >= 168 and b >= 120 and g <= 150:
        return "W2"
    if b >= 120 and b >= g + 20 and b >= r + 10:
        return "L2"
    if r >= 168 and 96 <= g <= 175 and b <= 96:
        return "L4"
    if r >= 96 and b >= 112 and g <= 104:
        return "L5"
    if g >= 132:
        return "n"
    if g >= 96:
        return "L3"
    return "?"


grid, hexes = [], []
for r in range(ROWS):
    row, hrow = [], []
    for c in range(COLS):
        rgb = cell_mode(c, r)
        row.append(classify(rgb))
        hrow.append(f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}")
    grid.append(row)
    hexes.append(hrow)

print("ผังจากสี (15 คอลัมน์ x 9 แถว):")
for r, row in enumerate(grid):
    print(f"R{r+1}: " + " ".join(f"{v:>2}" for v in row))
print("\nhex แถว 1:", " ".join(hexes[0]))
print("hex แถว 5:", " ".join(hexes[4]))

cnt = Counter(v for row in grid for v in row)
print("\nสรุป:", dict(cnt))
