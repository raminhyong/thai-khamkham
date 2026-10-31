#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""วิเคราะห์สีจริงบนกระดาน: หา palette หลัก + ขอบเขตกระดานในภาพ"""
from __future__ import annotations

from collections import Counter

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
W, H = im.size
px = im.load()

# 1) palette: quantize ทุก 2 px
cnt = Counter()
for y in range(0, H, 2):
    for x in range(0, W, 2):
        r, g, b = px[x, y]
        cnt[(r // 16 * 16, g // 16 * 16, b // 16 * 16)] += 1

print("=== 12 สีที่พบมากที่สุด ===")
for (r, g, b), n in cnt.most_common(12):
    print(f"  #{r:02x}{g:02x}{b:02x}  RGB({r},{g},{b})  {n:7,} px")

# 2) หาขอบเขตพื้นที่กระดาน (ตัดกรอบไม้สีน้ำตาลเข้มออก)
def is_frame(rgb):
    r, g, b = rgb
    return r < 110 and g < 90 and b < 90

xs = [x for x in range(W) if not is_frame(px[x, H // 2])]
ys = [y for y in range(H) if not is_frame(px[W // 2, y])]
print("\nขอบเขตใน (x):", min(xs), max(xs), "| (y):", min(ys), max(ys))
print("ความกว้างพื้นที่เล่น:", max(xs) - min(xs) + 1, "px · สูง:", max(ys) - min(ys) + 1, "px")
for n in (9, 11, 13, 15, 17):
    print(f"  ถ้า {n} ช่อง → ช่องละ {(max(xs)-min(xs)+1)/n:.1f} x {(max(ys)-min(ys)+1)/n:.1f} px")
