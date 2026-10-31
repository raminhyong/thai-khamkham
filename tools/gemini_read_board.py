#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ให้ Gemini อ่านผังกระดานคำคมจากภาพ แล้วคืน JSON"""
from __future__ import annotations

import base64
import json
import os
import re
import urllib.request

IMG = "/home/hermes/.hermes/cache/images/img_b5da2fe06b2d.jpg"
ENV = os.path.expanduser("~/.hermes/.env")

key = ""
for line in open(ENV, encoding="utf-8", errors="replace"):
    if re.match(r"^(GEMINI_API_KEY|GOOGLE_API_KEY)=", line):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
assert key, "ไม่พบคีย์ Gemini"

b64 = base64.b64encode(open(IMG, "rb").read()).decode()

prompt = """คุณคือผู้ช่วยอ่านผังกระดานเกม "คำคม" (Thai Scrabble-like) จากภาพถ่าย

งานของคุณ: อ่านผังกระดานให้ละเอียดที่สุด แล้วตอบเป็น JSON เท่านั้น

ขั้นแรก ให้ระบุโครงสร้าง:
- จำนวน "คอลัมน์" ของช่องตัวอักษร
- จำนวน "แถว" ของช่องตัวอักษร (นับเฉพาะแถวที่มีช่องสี่เหลี่ยมใหญ่สำหรับวางเบี้ย ไม่นับแถบสระ/วรรณยุกต์สีเหลืองบาง ๆ)
- จำนวน "แถบสระ" (แถวบางสีเหลืองที่ใช้วางสระบน-ล่าง/วรรณยุกต์)

ขั้นที่สอง ให้อ่านทีละช่องจากซ้ายไปขวา บนลงล่าง โดยใช้รหัสดังนี้
  N  = ช่องปกติ (เขียว/เหลืองอ่อน ไม่มีข้อความ)
  W2 = ชมพู "2 เท่า ของคำ"
  W3 = แดง "3 เท่า ของคำ"
  L2 = ฟ้า "2 เท่า ของตัวอักษร"
  L3 = เขียวเข้ม "3 เท่า ของตัวอักษร"
  L4 = ส้ม "4 เท่า ของตัวอักษร"
  L5 = ม่วง "5 เท่า ของตัวอักษร"

ตอบเป็น JSON รูปแบบนี้เท่านั้น (ไม่ต้องมีคำอธิบายอื่น):
{"cols": <int>, "letter_rows": <int>, "strip_rows": <int>, "grid": [["N","N",...], ...]}

ข้อสำคัญ: จำนวนสมาชิกในแต่ละแถวของ grid ต้องเท่ากับ cols และจำนวนแถวต้องเท่ากับ letter_rows
ถ้าตำแหน่งใดไม่แน่ใจ ให้ใส่ "?" ในช่องนั้น ห้ามเดา"""

payload = {
    "contents": [{
        "parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
        ]
    }],
    "generationConfig": {"temperature": 0, "maxOutputTokens": 30000, "responseMimeType": "application/json"},
}

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={key}"
req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                             headers={"Content-Type": "application/json"})
with urllib.request.urlopen(req, timeout=180) as r:
    out = json.load(r)

cand = out["candidates"][0]
print("finishReason:", cand.get("finishReason"))
text = cand["content"]["parts"][0]["text"]
print("chars:", len(text))
print(text[:200])

with open("/home/hermes/projects/thai-khamkham/data/gemini_board.txt", "w", encoding="utf-8") as f:
    f.write(text)
