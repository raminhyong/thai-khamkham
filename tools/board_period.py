#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""หาคาบ (period) จริงของช่องกระดานด้วย autocorrelation ของสัญญาณสี"""
from __future__ import annotations

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
W, H = im.size
px = im.load()

x0, x1, y0, y1 = 12, 1011, 43, 999


def is_yellow(rgb):
    r, g, b = rgb
    return r > 170 and g > 140 and b < 130


def is_green(rgb):
    r, g, b = rgb
    return g > 90 and r < 90 and b < 120


# สัญญาณแนวนอน: สัดส่วนเหลืองในแต่ละคอลัมน์
col_yellow = []
for x in range(x0, x1):
    n = sum(1 for y in range(y0, y1, 3) if is_yellow(px[x, y]))
    col_yellow.append(n)

row_yellow = []
for y in range(y0, y1):
    n = sum(1 for x in range(x0, x1, 3) if is_yellow(px[x, y]))
    row_yellow.append(n)


def best_period(sig, lo=30, hi=160):
    import statistics
    m = statistics.mean(sig)
    s = [v - m for v in sig]
    best, best_score = None, -1e18
    for p in range(lo, hi):
        # ผลบวกของ self-correlation ที่ lag p
        acc = 0.0
        cnt = 0
        for i in range(len(s) - p):
            acc += s[i] * s[i + p]
            cnt += 1
        score = acc / max(cnt, 1)
        if score > best_score:
            best_score, best = score, p
    return best, best_score


pc, sc = best_period(col_yellow)
pr, sr = best_period(row_yellow)
print(f"คาบแนวนอน (คอลัมน์): {pc} px → {(x1-x0)/pc:.1f} คอลัมน์")
print(f"คาบแนวตั้ง (แถว)    : {pr} px → {(y1-y0)/pr:.1f} แถว")

# แสดงสัญญาณเหลืองเป็นกราฟ ASCII เพื่อดูโครงสร้าง
print("\nสัดส่วนเหลืองรายแถว (ทุก 8 px):")
step = 8
for i in range(0, len(row_yellow), step):
    y = y0 + i
    v = row_yellow[i]
    bar = "#" * int(v / max(1, max(row_yellow)) * 40)
    if i % (step * 2) == 0:
        print(f"  y={y:4} {v:4} {bar}")
