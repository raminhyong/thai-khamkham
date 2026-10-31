#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""นับจำนวนคำในพจนานุกรมราชบัณฑิตฯ แยกตามตัวอักษรตั้งต้น

endpoint: GET /Lookup/lookupDomain.php?page=1&domain=<ตัวอักษร>
คืนค่า: [count, [คำ 10 รายการแรก]]
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0.0.0 Safari/537.36")
BASE = "https://dictionary.orst.go.th/Lookup/lookupDomain.php"
LETTERS = [chr(c) for c in range(0x0E01, 0x0E2F)]  # ก..ฮ


def probe(ch):
    url = f"{BASE}?page=1&domain={urllib.parse.quote(ch)}"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://dictionary.orst.go.th/lookup_domain.php",
        "X-Requested-With": "XMLHttpRequest",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8", "replace")
    data = json.loads(raw)
    return int(data[0]), data[1]


total = 0
rows = []
for ch in LETTERS:
    try:
        n, sample = probe(ch)
    except Exception as e:
        print(f"{ch} ERROR {e}")
        time.sleep(1)
        continue
    total += n
    rows.append({"letter": ch, "count": n})
    print(f"{ch} {n:6} | ตัวอย่าง: {', '.join(sample[:3])}")
    time.sleep(0.35)

print("-" * 50)
print("รวมทั้งพจนานุกรม:", total, "รายการ")
print("จำนวนหน้าถ้า 10 คำ/หน้า:", sum(-(-r["count"] // 10) for r in rows))
json.dump({"total": total, "rows": rows}, open("/tmp/orst_counts.json", "w"), ensure_ascii=False, indent=1)
