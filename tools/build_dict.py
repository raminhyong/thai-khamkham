# -*- coding: utf-8 -*-
"""สร้างชุดข้อมูลเกม "คำคม" (Thai Scrabble-like)

ที่มา: pythainlp 5.4.0 corpus/words_th.txt (รายการคำไทย ~62,000 คำ)
ผลลัพธ์:
  data/dict.json  → {"words": [...], "letters": {อักษร: {value, count}}}
ค่าตัวอักษรคำนวณจากความถี่ในรายการคำ (ไม่ใช่ตารางคะแนนทางการของเกมคำคม)
"""
from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter

import pythainlp

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
THAI = re.compile(r"^[\u0e01-\u0e2e\u0e30-\u0e3a\u0e40-\u0e4c]+$")
CONSONANTS = [chr(c) for c in range(0x0E01, 0x0E2F)]  # ก..ฮ (ตัด ฦ)

src = os.path.join(os.path.dirname(pythainlp.__file__), "corpus", "words_th.txt")
raw = open(src, encoding="utf-8").read().splitlines()

words = sorted({
    w.strip() for w in raw
    if 2 <= len(w.strip()) <= 12 and THAI.match(w.strip()) and w.strip() == w.strip()
})

freq = Counter()
for w in words:
    for ch in w:
        freq[ch] += 1

# ค่าตัวอักษร: ตัวที่พบมาก = 1 คะแนน, พบน้อย = สูงขึ้น (1-4)
cons_present = [c for c in CONSONANTS if freq.get(c, 0) > 0]
ranked = sorted(cons_present, key=lambda c: -freq.get(c, 0))
values = {}
n = len(ranked)
for i, c in enumerate(ranked):
    pct = i / max(n - 1, 1)
    values[c] = 1 if pct < 0.45 else 2 if pct < 0.75 else 3 if pct < 0.92 else 4

# จำนวนเบี้ยในถุง: สัดส่วนจากความถี่ รวม ~100 ตัว
total_freq = sum(freq.get(c, 0) for c in cons_present)
counts = {}
for c in cons_present:
    counts[c] = max(1, round(freq.get(c, 0) / total_freq * 100))
# ปรับให้รวมได้ 100 พอดี
while sum(counts.values()) > 100:
    k = max(counts, key=lambda x: counts[x])
    counts[k] -= 1
while sum(counts.values()) < 100:
    k = ranked[0]
    counts[k] += 1

vowels = sorted({ch for w in words for ch in w if ch not in CONSONANTS})
print("คำ:", len(words), "| พยัญชนะ:", len(cons_present), "| สระ/วรรณยุกต์:", len(vowels))
print("เบี้ยรวม:", sum(counts.values()))
print("ค่าสูงสุด 4:", [c for c in ranked if values[c] == 4][:12])

os.makedirs(OUT_DIR, exist_ok=True)
payload = {
    "meta": {
        "source": "pythainlp 5.4.0 corpus/words_th.txt",
        "note": "ค่าตัวอักษรคำนวณจากความถี่ ไม่ใช่ตารางคะแนนทางการ",
        "word_count": len(words),
    },
    "letters": {c: {"value": values[c], "count": counts[c]} for c in sorted(cons_present)},
    "words": words,
}
path = os.path.join(OUT_DIR, "dict.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
print("เขียน:", path, round(os.path.getsize(path) / 1024), "KB")
