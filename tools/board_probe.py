#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ตรวจโครงตารางของ Board.png: หาเส้นแบ่งช่องจาก gradient แล้วนับจำนวนช่อง"""
from __future__ import annotations

import colorsys

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
W, H = im.size
px = im.load()


def lum(x, y):
    r, g, b = px[x, y]
    return (r + g + b) / 3


def edges(axis: str, fixed: int):
    vals = []
    for i in range(1, (W if axis == "x" else H) - 1):
        a = lum(i - 1, fixed) if axis == "x" else lum(fixed, i - 1)
        b = lum(i + 1, fixed) if axis == "x" else lum(fixed, i + 1)
        vals.append((i, abs(b - a)))
    peaks = [i for i, d in vals if d > 12]
    # จัดกลุ่มพีคที่ติดกัน
    groups, cur = [], []
    for i in peaks:
        if cur and i - cur[-1] <= 3:
            cur.append(i)
        else:
            if cur:
                groups.append(sum(cur) // len(cur))
            cur = [i]
    if cur:
        groups.append(sum(cur) // len(cur))
    return groups


for name, axis, fixed in (("แนวนอน (ตัดกลางภาพ)", "x", H // 2), ("แนวตั้ง (ตัดกลางภาพ)", "y", W // 2)):
    g = edges(axis, fixed)
    print(f"{name}: พบเส้นแบ่ง {len(g)} เส้น")
    print("  ตำแหน่ง:", g[:25])
    if len(g) > 2:
        diffs = [g[i + 1] - g[i] for i in range(len(g) - 1)]
        diffs = [d for d in diffs if 15 < d < 120]
        diffs.sort()
        if diffs:
            med = diffs[len(diffs) // 2]
            print("  ระยะห่างช่อง (median):", med, "px → ประมาณ", round((g[-1] - g[0]) / med) + 1, "ช่อง")

# ตรวจแถบสี: นับการเปลี่ยนสีตามแนวตั้ง/แนวนอน
def hsv(x, y):
    r, g, b = [v / 255 for v in px[x, y]]
    return colorsys.rgb_to_hsv(r, g, b)


print("\nสีกลางภาพ (10,10):", px[10, 10], "| hsv:", [round(v, 2) for v in hsv(10, 10)])
print("สีกลางกระดาน:", px[W // 2, H // 2], "| hsv:", [round(v, 2) for v in hsv(W // 2, H // 2)])
print("มุมใน (60,60):", px[60, 60])
