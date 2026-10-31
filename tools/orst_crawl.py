#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ดึงคำทั้งหมดจากพจนานุกรมฉบับราชบัณฑิตยสถาน พ.ศ.2554 (dictionary.orst.go.th)

endpoint ที่เว็บใช้จริง: GET /Lookup/lookupDomain.php?page=N&domain=<ตัวอักษร>
คืน JSON: [count, [คำ 10 รายการ]] — หน้าละ 10 คำคงที่

คุณสมบัติ:
  - ทำต่อได้ (resume) ด้วย checkpoint ต่อตัวอักษร → data/orst/checkpoint.json
  - เขียนผลแบบ streaming ลง data/orst/raw.jsonl (กันข้อมูลหายถ้าหยุดกลางทาง)
  - หน่วง 0.25 วิ/คำขอ + retry แบบถอยหลัง (สุภาพกับเซิร์ฟเวอร์ราชบัณฑิตฯ)
"""
from __future__ import annotations

import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")
BASE = "https://dictionary.orst.go.th/Lookup/lookupDomain.php"
REFERER = "https://dictionary.orst.go.th/lookup_domain.php"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "orst")
RAW = os.path.join(OUT_DIR, "raw.jsonl")
CKPT = os.path.join(OUT_DIR, "checkpoint.json")
DELAY = 0.25

LETTERS = [chr(c) for c in range(0x0E01, 0x0E2F)]  # ก..ฮ


def load_ckpt():
    if os.path.exists(CKPT):
        return json.load(open(CKPT, encoding="utf-8"))
    return {}


def save_ckpt(ck):
    os.makedirs(OUT_DIR, exist_ok=True)
    tmp = CKPT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(ck, f, ensure_ascii=False, indent=1)
    os.replace(tmp, CKPT)


def fetch(ch: str, page: int, tries: int = 4):
    url = f"{BASE}?page={page}&domain={urllib.parse.quote(ch)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Referer": REFERER, "X-Requested-With": "XMLHttpRequest",
    })
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8", "replace"))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (attempt + 1) + random.random())
    raise RuntimeError(f"{ch} หน้า {page}: {last}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ck = load_ckpt()
    total_added = 0

    with open(RAW, "a", encoding="utf-8") as out:
        for ch in LETTERS:
            if ck.get(ch, {}).get("done"):
                continue
            try:
                first = fetch(ch, 1)
            except Exception as e:  # noqa: BLE001
                print("ข้าม", ch, e, flush=True)
                continue
            count = int(first[0])
            pages = max(1, -(-count // 10))
            start = ck.get(ch, {}).get("last_page", 0) + 1

            if start == 1:
                for w in first[1]:
                    out.write(json.dumps({"w": w, "l": ch}, ensure_ascii=False) + "\n")
                    total_added += 1
                start = 2

            for page in range(start, pages + 1):
                try:
                    data = fetch(ch, page)
                except Exception as e:  # noqa: BLE001
                    print("หยุดที่", ch, page, e, flush=True)
                    ck[ch] = {"last_page": page - 1, "done": False, "count": count}
                    save_ckpt(ck)
                    out.flush()
                    return 1
                for w in data[1]:
                    out.write(json.dumps({"w": w, "l": ch}, ensure_ascii=False) + "\n")
                    total_added += 1
                ck[ch] = {"last_page": page, "done": page >= pages, "count": count}
                save_ckpt(ck)
                if page % 25 == 0:
                    print(f"{ch}: {page}/{pages} หน้า (+{total_added} คำ)", flush=True)
                out.flush()
                time.sleep(DELAY + random.random() * 0.1)

            print(f"✓ {ch} เสร็จ {count} รายการ", flush=True)
            out.flush()

    print(f"เสร็จทั้งหมด: เพิ่ม {total_added} รายการ", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
