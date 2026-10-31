#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""อ่านผังกระดานอีกแบบ: ให้ Gemini ระบุ 'พิกัด' ของช่องพิเศษ (ผลลัพธ์อีกรูปแบบ เพื่อตรวจไขว้)"""
from __future__ import annotations

import base64
import json
import os
import re
import urllib.request

IMG = "/home/hermes/.hermes/cache/images/img_b5da2fe06b2d.jpg"
ENV = os.path.expanduser("~/.hermes/.env")
OUT = "/home/hermes/projects/thai-khamkham/data/gemini_board_coords.json"

key = ""
for line in open(ENV, encoding="utf-8", errors="replace"):
    if re.match(r"^(GEMINI_API_KEY|GOOGLE_API_KEY)=", line):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

b64 = base64.b64encode(open(IMG, "rb").read()).decode()

prompt = """ภาพนี้คือกระดานเกม "คำคม" (EduPLOYS) ซึ่งเป็นตารางช่องตัวอักษร สลับกับแถบสีเหลืองบาง ๆ ที่ใช้วางสระ/วรรณยุกต์

งาน: ระบุ "พิกัด" ของช่องพิเศษทุกช่อง โดยนับเฉพาะแถวของช่องตัวอักษร (ไม่นับแถบสระสีเหลืองบาง)
- แถวที่ 1 = แถวบนสุดของช่องตัวอักษร, คอลัมน์ที่ 1 = ซ้ายสุด
- ชนิดช่อง: W2 (ชมพู 2 เท่าของคำ), W3 (แดง 3 เท่าของคำ), L2 (ฟ้า 2 เท่าของตัวอักษร), L3 (เขียวเข้ม 3 เท่าของตัวอักษร), L4 (ส้ม 4 เท่าของตัวอักษร), L5 (ม่วง 5 เท่าของตัวอักษร)

ตอบเป็น JSON เท่านั้น:
{"cols": <int>, "rows": <int>, "cells": {"W3": [[r,c],...], "W2": [...], "L2": [...], "L3": [...], "L4": [...], "L5": [...]}}

อ่านให้ครบทุกช่อง ตรวจสอบซ้ำว่าช่องที่อยู่ใกล้กันแต่สีต่างกัน (เช่น เขียวเข้มกับเขียวอ่อน) แยกถูก
ถ้าไม่แน่ใจช่องใด ให้ใส่ในคีย์ "unsure": [[r,c],...]"""

payload = {
    "contents": [{"parts": [{"text": prompt},
                            {"inline_data": {"mime_type": "image/jpeg", "data": b64}}]}],
    "generationConfig": {"temperature": 0, "maxOutputTokens": 20000,
                         "responseMimeType": "application/json"},
}
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={key}"
req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                             headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=240) as r:
    out = json.load(r)

cand = out["candidates"][0]
print("finishReason:", cand.get("finishReason"))
text = cand["content"]["parts"][0]["text"]
d = json.loads(text)
print("cols/rows:", d.get("cols"), d.get("rows"))
counts = {k: len(v) for k, v in d.get("cells", {}).items()}
print("จำนวนช่องพิเศษ:", counts, "| รวม", sum(counts.values()))
print("unsure:", d.get("unsure"))
json.dump(d, open(OUT, "w"), ensure_ascii=False, indent=1)
print("เขียน:", OUT)
