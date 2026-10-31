#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""สร้าง data/dict.json สำหรับเกม = ORST (เฉพาะคำสมบูรณ์) + allowlist ที่ครูเพิ่มเอง

เหตุผล: ผู้ใช้กำหนดว่า "คำที่ลงในเกมต้องเป็นคำสมบูรณ์เท่านั้น"
  - ORST (ราชบัณฑิตฯ 2554) = แหล่งอ้างอิงหลัก → ใช้ตอบ Challenge ได้
  - ไม่ดึง pythainlp เพราะมีวลีเขียนติดกัน (เช่น "ในกรณีที่เป็น", "โดยไม่ได้คาดฝัน")
    ซึ่งไม่ใช่คำเดี่ยว และจะทำให้ตรวจคำไม่ตรงกับพจนานุกรม
  - คำร่วมสมัยที่ ORST ยังไม่มี (มือถือ/อีเมล/แชท) → ครูเพิ่มเองได้ที่ data/orst/allowlist.txt
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_orst_dict import why_reject

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORST = os.path.join(ROOT, "data", "orst", "words.json")
ALLOW = os.path.join(ROOT, "data", "orst", "allowlist.txt")
DICT = os.path.join(ROOT, "data", "dict.json")


def load_allow():
    if not os.path.exists(ALLOW):
        return set(), []
    ok, bad = set(), []
    for line in open(ALLOW, encoding="utf-8"):
        w = line.strip()
        if not w or w.startswith("#"):
            continue
        if why_reject(w):
            bad.append(w)
        else:
            ok.add(w)
    return ok, bad


def main():
    orst = set(json.load(open(ORST, encoding="utf-8"))["words"])
    allow, bad = load_allow()
    old = json.load(open(DICT, encoding="utf-8"))
    letters = old["letters"]

    words = sorted(orst | allow)
    payload = {
        "meta": {
            "primary": "พจนานุกรมฉบับราชบัณฑิตยสถาน พ.ศ.2554 (dictionary.orst.go.th)",
            "rule": "คำไทยล้วน ไม่มี -, เว้นวรรค, ฯ ๆ วงเล็บ จุด ความยาว 2-15",
            "orst_words": len(orst),
            "allowlist": len(allow),
            "total": len(words),
            "fetched_at": "2026-10-31",
        },
        "letters": letters,
        "words": words,
    }
    json.dump(payload, open(DICT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"ORST (คำสมบูรณ์) : {len(orst):,}")
    print(f"allowlist ของครู : {len(allow):,}" + (f"  (ตัดออก {len(bad)}: {bad})" if bad else ""))
    print(f"รวมพจนานุกรมเกม  : {len(words):,}")
    print("เขียน:", DICT, round(os.path.getsize(DICT) / 1024), "KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
