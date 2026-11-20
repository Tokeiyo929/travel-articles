import sys, json, re, glob
sys.stdout.reconfigure(encoding="utf-8")
import openpyxl

all_rows = {}
seen = set()
for f in sorted(glob.glob("ctrip-orders-*.xlsx")):
    wb = openpyxl.load_workbook(f)
    ws = wb.worksheets[0]
    n = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or not r[0]:
            continue
        no = str(r[0]).replace("订单号:", "").replace("订单号：", "").strip()
        if no in seen:
            continue
        seen.add(no)
        all_rows[no] = {
            "order_no": no,
            "book_date": str(r[1] or ""),
            "title": str(r[2] or ""),
            "route_raw": str(r[3] or ""),
            "passenger": str(r[4] or ""),
            "status": str(r[5] or ""),
            "price": str(r[6] or ""),
        }
        n += 1
    print(f, "->", n, "rows")

rows = list(all_rows.values())
with open("ctrip-orders-merged.json", "w", encoding="utf-8") as fjson:
    json.dump(rows, fjson, ensure_ascii=False, indent=1)

def classify(o):
    rr = o["route_raw"]
    if re.search(r"[KTDGZC]\d{3,4}", rr) and "出发日期" in rr:
        return "train"
    if "火车" in o["title"] or "高铁" in o["title"]:
        return "train?"
    if "至" in rr and re.search(r"\d{2}:\d{2}", rr):
        return "flight"
    if "机票" in o["title"] or "航空" in o["title"]:
        return "flight?"
    return "other"

from collections import Counter
c = Counter(classify(o) for o in rows)
print("TOTAL:", len(rows), dict(c))
print("=== 火车票全部 ===")
for o in rows:
    if classify(o).startswith("train"):
        print(o["book_date"], "|", o["status"], "|", o["title"].replace("\n", "+"), "|", o["route_raw"].replace("\n", " / "))
