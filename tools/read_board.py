#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""อ่านผังกระดานคำคม 15x15 จาก refs/Board.png → data/board.json

วิธี: สุ่มสีกลางช่อง แล้วจำแนกชนิดช่องด้วย HSV
  ชมพู = x2 คำ · แดง = x3 คำ · ฟ้า = x2 ตัวอักษร · เขียว = x3 ตัวอักษร
  ส้ม = x4 ตัวอักษร · ม่วง = x5 ตัวอักษร · ขาว/เทา = ช่องปกติ
"""
from __future__ import annotations

import colorsys
import json
import os
from collections import Counter

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "refs", "Board.png")
OUT = os.path.join(ROOT, "data", "board.json")
N = 15

im = Image.open(SRC).convert("RGB")
W, H = im.size
print("ภาพ:", W, "x", H)

# หาขอบกระดาน: คอลัมน์/แถวแรกที่ไม่ใช่สีขาวล้วน
px = im.load()


def is_blankish(rgb):
    r, g, b = rgb
    return r > 245 and g > 245 and b > 245


cols = [x for x in range(W) if any(not is_blankish(px[x, y]) for y in range(0, H, 4))]
rows = [y for y in range(H) if any(not is_blankish(px[x, y]) for x in range(0, W, 4))]
x0, x1 = (min(cols), max(cols)) if cols else (0, W - 1)
y0, y1 = (min(rows), max(rows)) if rows else (0, H - 1)
print("ขอบกระดาน:", (x0, y0), "→", (x1, y1))

cw = (x1 - x0 + 1) / N
ch = (y1 - y0 + 1) / N


def classify(rgb):
    r, g, b = [v / 255 for v in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    deg = h * 360
    if s < 0.12 or v > 0.96:
        return None                      # ขาว/เทา = ปกติ
    if s < 0.2 and v > 0.85:
        return None
    if 300 <= deg or deg < 20:           # แดง/ชมพู
        return "W3" if (deg >= 340 or deg < 12) and s > 0.55 else "W2"
    if 20 <= deg < 45:
        return "L4"                      # ส้ม
    if 45 <= deg < 70:
        return "L4"                      # เหลืองอมส้ม
    if 70 <= deg < 165:
        return "L3"                      # เขียว
    if 165 <= deg < 250:
        return "L2"                      # ฟ้า
    if 250 <= deg < 300:
        return "L5"                      # ม่วง
    return None


grid = []
samples = Counter()
for r in range(N):
    row = []
    for c in range(N):
        cx = int(x0 + cw * (c + 0.5))
        cy = int(y0 + ch * (r + 0.5))
        # เฉลี่ยกลางช่อง 40%
        box = [
            px[x, y]
            for y in range(max(0, int(cy - ch * 0.2)), min(H, int(cy + ch * 0.2)), 3)
            for x in range(max(0, int(cx - cw * 0.2)), min(W, int(cx + cw * 0.2)), 3)
        ]
        if not box:
            row.append(None)
            continue
        avg = tuple(sum(v[i] for v in box) // len(box) for i in range(3))
        t = classify(avg)
        samples[t] += 1
        row.append(t)
    grid.append(row)

symbols = {None: " .", "W2": "W2", "W3": "W3", "L2": "L2", "L3": "L3", "L4": "L4", "L5": "L5"}
print("\nผังที่อ่านได้:")
for r in range(N):
    print(" ".join(f"{symbols.get(grid[r][c], '??'):>2}" for c in range(N)))

cnt = Counter(v for row in grid for v in row)
print("\nสรุป:", dict(cnt))
print("ช่องปกติ:", cnt[None], "| ช่องพิเศษ:", N * N - cnt[None])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({"size": N, "cells": grid,
           "legend": {"W2": "x2 word", "W3": "x3 word", "L2": "x2 letter",
                      "L3": "x3 letter", "L4": "x4 letter", "L5": "x5 letter", None: "normal"}},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("เขียน:", OUT)
