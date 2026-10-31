#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""กรองรายการจากพจนานุกรมราชบัณฑิตฯ → เฉพาะ "คำสมบูรณ์" ที่ใช้ในเกมได้

กฎ (ตามที่ผู้ใช้กำหนด 31 ต.ค. 2569):
  1. ต้องเป็นคำไทยล้วน — ตัวอักษรที่เกมมีให้วางได้เท่านั้น
     (พยัญชนะ ก–ฮ · สระ/วรรณยุกต์ ะ–์)
  2. ห้ามมีเครื่องหมาย '-') ติดท้ายหรือที่ใด ๆ (เช่น "กมล-", "กช-") เพราะเป็นรากศัพท์/คำที่ไม่ใช้เดี่ยว
  3. ห้ามมีเว้นวรรค (วลี/สำนวน) · ห้ามมี ฯ ๆ ( ) . , / ตัวเลข ฯลฯ
  4. ความยาว 2–15 ตัวอักษร

ผลลัพธ์: data/orst/words.json  (รายการคำสมบูรณ์) + รายงานสถิติทาง stdout
"""
from __future__ import annotations

import json
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "orst", "raw.jsonl")
OUT = os.path.join(ROOT, "data", "orst", "words.json")

CONSONANTS = {chr(c) for c in range(0x0E01, 0x0E2F)}          # ก–ฮ
MARKS = {chr(c) for c in range(0x0E30, 0x0E3B)}              # ะ า ำ ิ ี ึ ื ุ ู ฺ ์ ํ ๎ ๏
LEAD_VOWELS = {chr(c) for c in range(0x0E40, 0x0E45)}        # เ แ โ ใ ไ
TONES = {chr(c) for c in range(0x0E47, 0x0E4D)}              # ็ ่ ้ ๊ ๋ ์ ํ ๎ (ไม่รวม ๆ ฯ)
ALLOWED = CONSONANTS | MARKS | LEAD_VOWELS | TONES


def why_reject(w: str) -> str | None:
    if "-" in w:
        return "ยัติภังค์"
    if " " in w:
        return "เว้นวรรค"
    bad = [ch for ch in w if ch not in ALLOWED]
    if bad:
        return f"อักขระต้องห้าม {''.join(sorted(set(bad)))}"
    if len(w) < 2:
        return "สั้นเกินไป"
    if len(w) > 15:
        return "ยาวเกินไป"
    return None


def main():
    if not os.path.exists(RAW):
        print("ยังไม่มี raw.jsonl — รอให้ตัวดึงข้อมูลทำงานก่อน")
        return 1
    rows = [json.loads(l) for l in open(RAW, encoding="utf-8") if l.strip()]
    words, rejects = [], Counter()
    seen = set()
    dup = 0
    for r in rows:
        w = r["w"].strip()
        reason = why_reject(w)
        if reason:
            rejects[reason] += 1
            continue
        if w in seen:
            dup += 1
            continue
        seen.add(w)
        words.append(w)

    words.sort()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"source": "พจนานุกรมฉบับราชบัณฑิตยสถาน พ.ศ.2554 (dictionary.orst.go.th)",
               "fetched_at": "2026-10-31",
               "rule": "คำไทยล้วน ไม่มี -, เว้นวรรค, ฯ ๆ วงเล็บ จุด ความยาว 2-15",
               "count": len(words), "words": words},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    print(f"รับเข้าคลัง : {len(words):,} คำ")
    print(f"ตัดออก      : {sum(rejects.values()):,} รายการ (ซ้ำ {dup:,})")
    for reason, n in rejects.most_common():
        print(f"   - {reason:22} {n:,}")
    print("ตัวอย่างที่รับเข้า :", ", ".join(words[:12]))
    print("ตัวอย่างที่ตัดออก  :", ", ".join([r["w"] for r in rows if why_reject(r["w"].strip())][:12]))
    print("เขียน:", OUT, round(os.path.getsize(OUT) / 1024), "KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
