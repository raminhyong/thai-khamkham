#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""วัดเส้นตารางจริงของกระดาน: นับเส้นเข้มตามแนวตั้ง (คอลัมน์) และแนวนอน (แถว)"""
from __future__ import annotations

from PIL import Image

im = Image.open("/home/hermes/.hermes/cache/images/img_b5da2fe06b2d.jpg").convert("RGB")
W, H = im.size
px = im.load()


def dark(x, y, thr=70):
    r, g, b = px[x, y]
    return (r + g + b) / 3 < thr


def lines_x(y):
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


def lines_y(x):
    ys = [y for y in range(H) if dark(x, y)]
    groups, cur = [], []
    for y in ys:
        if cur and y - cur[-1] <= 2:
            cur.append(y)
        else:
            if cur:
                groups.append(sum(cur) // len(cur))
            cur = [y]
    if cur:
        groups.append(sum(cur) // len(cur))
    return groups


for y in (200, 400, 600, 800):
    g = lines_x(y)
    gaps = [g[i + 1] - g[i] for i in range(len(g) - 1)] if len(g) > 1 else []
    print(f"y={y}: {len(g)} lines → gaps {gaps[:16]}")

for x in (200, 400, 600, 800):
    g = lines_y(x)
    gaps = [g[i + 1] - g[i] for i in range(len(g) - 1)] if len(g) > 1 else []
    print(f"x={x}: {len(g)} lines → gaps {gaps[:16]}")
