"""CampusCare JSON API. Python 3.9+, standard library only."""
from __future__ import annotations

import json
import re
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_FILE = DATA_DIR / "complaints.json"
LOCK = threading.RLock()
CATEGORIES = {"Wi-Fi": 2, "Hostel": 2, "Classroom": 1, "Laboratory": 3}
DEPARTMENTS = {"Wi-Fi": "IT Department", "Hostel": "Hostel Management", "Classroom": "Facility Management", "Laboratory": "Lab Administration"}
STATUSES = ["Raised", "In Progress", "Resolved"]
MAX_DESCRIPTION = 1000


def now_ms() -> int:
    return int(time.time() * 1000)


def load_db() -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        return {"nextId": 1, "complaints": []}
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("complaints"), list):
            raise ValueError("invalid data shape")
        records = [c for c in data["complaints"] if valid_record(c)]
        next_id = max(int(data.get("nextId", 1)), max((id_number(c["id"]) + 1 for c in records), default=1))
        return {"nextId": next_id, "complaints": records}
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return {"nextId": 1, "complaints": []}


def save_db(db: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp = DATA_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(DATA_FILE)


def valid_record(c: object) -> bool:
    return (isinstance(c, dict) and isinstance(c.get("id"), str) and c.get("category") in CATEGORIES
            and isinstance(c.get("description"), str) and isinstance(c.get("submittedAt"), (int, float))
            and c.get("status") in STATUSES)


def id_number(value: str) -> int:
    match = re.search(r"\d+", value)
    return int(match.group()) if match else 2**63 - 1


def enrich(c: dict, at: int | None = None) -> dict:
    age = max(0, ((at if at is not None else now_ms()) - int(c["submittedAt"])) / 3_600_000)
    result = dict(c)
    result["ageHours"] = age
    result["urgencyScore"] = CATEGORIES[c["category"]] + int(age // 24)
    result["department"] = DEPARTMENTS[c["category"]]
    result["overdueLevel"] = None if c["status"] == "Resolved" else ("Normal" if age < 24 else "Overdue" if age <= 48 else "Critical")
    return result


def sorted_priority(records: list[dict]) -> list[dict]:
    pending = [enrich(c) for c in records if c["status"] != "Resolved"]
    return sorted(pending, key=lambda c: (-c["urgencyScore"], c["submittedAt"], id_number(c["id"])))


class Handler(SimpleHTTPRequestHandler):
    server_version = "CampusCare/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 64_000:
                raise ValueError("Request body is missing or too large.")
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict):
                raise ValueError("Expected a JSON object.")
            return value
        except (ValueError, json.JSONDecodeError) as exc:
            raise ValueError(str(exc)) from exc

    def do_GET(self):
        path = urlparse(self.path).path
        with LOCK:
            db = load_db()
            if path == "/api/health":
                return self.send_json(200, {"ok": True, "service": "CampusCare API"})
            if path == "/api/complaints":
                records = [enrich(c) for c in db["complaints"]]
                return self.send_json(200, {"complaints": records})
            if path == "/api/priority":
                return self.send_json(200, {"complaints": sorted_priority(db["complaints"])[:3]})
            if path == "/api/stats":
                records = db["complaints"]
                unresolved = [c for c in records if c["status"] != "Resolved"]
                cats = {name: sum(c["category"] == name for c in records) for name in CATEGORIES}
                return self.send_json(200, {"total": len(records), "pending": len(unresolved), "resolved": len(records)-len(unresolved),
                    "inProgress": sum(c["status"] == "In Progress" for c in records),
                    "critical": sum(enrich(c)["ageHours"] > 48 for c in unresolved), "byCategory": cats})
            match = re.fullmatch(r"/api/complaints/(C[\w-]+)", path)
            if match:
                record = next((c for c in db["complaints"] if c["id"].lower() == match.group(1).lower()), None)
                return self.send_json(200, enrich(record)) if record else self.send_json(404, {"error": "Complaint not found."})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/complaints":
            return self.send_json(404, {"error": "Endpoint not found."})
        try:
            data = self.read_json()
            category = data.get("category")
            description = data.get("description")
            if category not in CATEGORIES:
                return self.send_json(400, {"error": "Choose a valid category."})
            if not isinstance(description, str) or not description.strip():
                return self.send_json(400, {"error": "Description is required."})
            if len(description.strip()) > MAX_DESCRIPTION:
                return self.send_json(400, {"error": f"Description must be {MAX_DESCRIPTION} characters or fewer."})
            with LOCK:
                db = load_db()
                used = {c["id"].lower() for c in db["complaints"]}
                n = db["nextId"]
                while f"C{n:03d}".lower() in used:
                    n += 1
                record = {"id": f"C{n:03d}", "category": category, "description": description.strip(), "submittedAt": now_ms(), "status": "Raised"}
                for field in ("problemType", "location", "severity"):
                    value = data.get(field)
                    if isinstance(value, str) and value.strip():
                        record[field] = value.strip()[:160]
                db["complaints"].append(record)
                db["nextId"] = n + 1
                save_db(db)
            return self.send_json(201, enrich(record))
        except ValueError as exc:
            return self.send_json(400, {"error": str(exc)})

    def do_PATCH(self):
        match = re.fullmatch(r"/api/complaints/(C[\w-]+)", urlparse(self.path).path)
        if not match:
            return self.send_json(404, {"error": "Endpoint not found."})
        try:
            data = self.read_json()
            status = data.get("status")
            if status not in STATUSES:
                return self.send_json(400, {"error": "Invalid status."})
            with LOCK:
                db = load_db()
                record = next((c for c in db["complaints"] if c["id"].lower() == match.group(1).lower()), None)
                if not record:
                    return self.send_json(404, {"error": "Complaint not found."})
                if STATUSES.index(status) != STATUSES.index(record["status"]) + 1:
                    return self.send_json(409, {"error": "Status must move forward: Raised → In Progress → Resolved."})
                record["status"] = status
                record["updatedAt"] = now_ms()
                save_db(db)
            return self.send_json(200, enrich(record))
        except ValueError as exc:
            return self.send_json(400, {"error": str(exc)})

    def do_DELETE(self):
        if urlparse(self.path).path != "/api/complaints":
            return self.send_json(404, {"error": "Endpoint not found."})
        with LOCK:
            db = load_db()
            db["complaints"] = []
            # Keep nextId so identifiers are never reused after deletion.
            save_db(db)
        return self.send_json(200, {"ok": True, "deleted": True})

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    host, port = "127.0.0.1", 8080
    print(f"CampusCare serving at http://{host}:{port}")
    print("API health: http://127.0.0.1:8080/api/health")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
