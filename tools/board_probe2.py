#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""นับช่องจริงบนกระดาน: หาเส้นตารางสีเข้มตามแนวนอน/แนวตั้ง + แถบเหลือง"""
from __future__ import annotations

from PIL import Image

im = Image.open("/home/hermes/projects/thai-khamkham/refs/Board.png").convert("RGB")
W, H = im.size
px = im.load()


def dark(x, y, thr=90):
    r, g, b = px[x, y]
    return (r + g + b) / 3 < thr


def yellow(x, y):
    r, g, b = px[x, y]
    return r > 180 and g > 150 and b < 120


def count_lines(y):
    xs = [x for x in range(W) if dark(x, y)]
    groups, cur = [], []
    for x in xs:
        if cur and x - cur[-1] <= 2:
            cur.append(x)
        else:
            if cur:
                groups.append(sum(cur) // len(cur))
            cur = [x]
    if cur:
        groups.append(sum(cur) // len(cur))
    return groups


def count_rows_of_yellow():
    rows = [y for y in range(H) if sum(1 for x in range(0, W, 8) if yellow(x, y)) > W / 8 * 0.5]
    groups, cur = [], []
    for y in rows:
        if cur and y - cur[-1] <= 3:
            cur.append(y)
        else:
            if cur:
                groups.append(sum(cur) // len(cur))
            cur = [y]
    if cur:
        groups.append(sum(cur) // len(cur))
    return groups


for y in (150, 200, 250, 300):
    g = count_lines(y)
    print(f"y={y}: เส้นเข้ม {len(g)} ตำแหน่ง → {(g[:16] if g else [])}")
    if len(g) >= 3:
        gaps = [g[i + 1] - g[i] for i in range(len(g) - 1)]
        print("    ช่วงห่าง:", gaps[:14])

ys = count_rows_of_yellow()
print("\nแถบเหลือง (แถว):", len(ys), "→", ys[:20])
