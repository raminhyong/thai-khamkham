#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""อ่านผังกระดาน 15x15 (จัตุรัส) จาก refs/Board.png

เหตุผลที่แก้: ผู้ใช้ยืนยันว่ากระดานเป็น 'จัตุรัส' และมีช่องวางสระในทุกช่อง
จากภาพ: พื้นที่เล่น 1000x956 px → ช่องละ ~66.7 x 63.7 px = 15x15 ช่อง (225)
โดย 135 ช่องปกติ + 90 ช่องพิเศษ (ตรงกับคู่มือ)
"""
from __future__ import annotations

import colorsys
import json
from collections import Counter

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
px = im.load()
X0, X1, Y0, Y1 = 12, 1012, 43, 999
N = 15
cw = (X1 - X0) / N
ch = (Y1 - Y0) / N


def stats(r, c):
    xa = int(X0 + cw * c + cw * 0.18)
    xb = int(X0 + cw * (c + 1) - cw * 0.18)
    ya = int(Y0 + ch * r + ch * 0.18)
    yb = int(Y0 + ch * (r + 1) - ch * 0.18)
    white = 0
    total = 0
    hues = Counter()
    for y in range(ya, yb, 2):
        for x in range(xa, xb, 2):
            rr, gg, bb = px[x, y]
            total += 1
            if rr > 205 and gg > 205 and bb > 205:
                white += 1
                continue
            h, s, v = colorsys.rgb_to_hsv(rr / 255, gg / 255, bb / 255)
            if s < 0.18:
                continue
            hues[(round(h * 360 / 20) * 20, round(s * 4), round(v * 4))] += 1
    return white / max(total, 1), hues.most_common(1)[0][0] if hues else None


def label(frac, hsv):
    if frac < 0.05 or hsv is None:
        return "n"
    h, s4, v4 = hsv
    if h < 20 or h >= 340:
        return "W3" if s4 >= 3 else "W2"
    if h < 50:
        return "L4"
    if h < 170:
        return "L3"
    if h < 260:
        return "L2"
    return "L5"


grid = []
for r in range(N):
    row = []
    for c in range(N):
        frac, hsv = stats(r, c)
        row.append(label(frac, hsv))
    grid.append(row)

SYM = {"n": " .", "W2": "W2", "W3": "W3", "L2": "L2", "L3": "L3", "L4": "L4", "L5": "L5"}
for r, row in enumerate(grid):
    print(f"r{r+1:2} " + " ".join(f"{SYM[v]:>2}" for v in row))

cnt = Counter(v for row in grid for v in row)
print("\nสรุป:", dict(cnt), "| รวม", sum(cnt.values()), "| ปกติ", cnt["n"], "| พิเศษ", 225 - cnt["n"])

json.dump(grid, open("/home/hermes/projects/thai-khamkham/data/board15_raw.json", "w"), ensure_ascii=False, indent=1)
