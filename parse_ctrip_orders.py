import sys, json, re
sys.stdout.reconfigure(encoding="utf-8")
import openpyxl

wb = openpyxl.load_workbook("ctrip-orders-all.xlsx")
ws = wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True))
out = []
for r in rows[1:]:
    if not r or not r[0]:
        continue
    out.append({
        "order_no": str(r[0]),
        "book_date": str(r[1] or ""),
        "title": str(r[2] or ""),
        "route_raw": str(r[3] or ""),
        "passenger": str(r[4] or ""),
        "status": str(r[5] or ""),
        "price": str(r[6] or ""),
    })
with open("ctrip-orders-all.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)

# 分类：火车票（route_raw 含 车次号格式）/ 机票（含  至  时间对）
def classify(o):
    rr = o["route_raw"]
    # 火车票特征：出发日期：...至... 车次（K/T/G/D/Z/C+数字）
    if re.search(r"[KTDGZC]\d{3,4}", rr) and "出发日期" in rr:
        return "train"
    if "至" in rr and re.search(r"\d{2}:\d{2}", rr):
        return "flight"
    return "other"

trains = [o for o in out if classify(o) == "train"]
flights = [o for o in out if classify(o) == "flight"]
print(f"total={len(out)} train={len(trains)} flight={len(flights)}")
print("--- TRAINS ---")
for o in trains:
    print(o["status"], "|", o["title"], "|", o["route_raw"].replace("\n", " / "))
print("--- FLIGHTS ---")
for o in flights:
    print(o["status"], "|", o["title"].replace("\n", " + "), "|", o["route_raw"].replace("\n", " / "))
