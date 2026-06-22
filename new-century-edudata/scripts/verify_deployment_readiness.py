#!/usr/bin/env python3
"""Verify the deployed ACE System can serve real teaching-management flows."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path
from typing import Any
from urllib import error, request

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_FILE = PROJECT_ROOT / "frontend" / "src" / "data" / "demoSchoolData.js"


DEFAULT_BASE_URL = "https://ace-system-sandy.vercel.app"
DEFAULT_PASSWORD = "NewCentury2025!"


def endpoint(base_url: str, path: str) -> str:
    return base_url.rstrip("/") + path


def load_demo_data() -> dict[str, Any]:
    node_code = f"""
      const {{ DEMO_SCHOOL_DATA }} = require({json.dumps(str(DATA_FILE))});
      process.stdout.write(JSON.stringify(DEMO_SCHOOL_DATA));
    """
    result = subprocess.run(
        ["node", "-e", node_code],
        cwd=str(PROJECT_ROOT),
        check=True,
        text=True,
        capture_output=True,
    )
    return json.loads(result.stdout)


def class_code(value: Any) -> str:
    return str(value or "").replace("班", "").strip()


def request_json(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
    timeout: int = 30,
) -> tuple[int, dict[str, Any] | list[Any] | str]:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return response.status, parse_json(body)
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, parse_json(body)
    except error.URLError as exc:
        return 0, {"detail": str(exc.reason)}


def parse_json(body: str) -> dict[str, Any] | list[Any] | str:
    if not body:
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return body[:500]


def record(
    results: list[tuple[str, bool, str]],
    label: str,
    ok: bool,
    detail: str,
) -> bool:
    results.append((label, ok, detail))
    mark = "OK" if ok else "FAIL"
    print(f"[{mark}] {label}: {detail}")
    return ok


def demo_parent_case() -> dict[str, Any]:
    data = load_demo_data()
    students = {int(student["id"]): student for student in data["students"]}
    parent = next(item for item in data["parents"] if item.get("phone") and item.get("student_ids"))
    student = students[int(parent["student_ids"][0])]
    return {
        "parent_username": parent["phone"],
        "student_id": int(student["id"]),
        "student_name": student["name"],
        "class_name": class_code(student.get("class_id")),
        "auth_code": str(student.get("student_code") or "")[-6:],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("ACE_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--dean-username", default=os.getenv("ACE_DEAN_USERNAME", "dean"))
    parser.add_argument("--dean-password", default=os.getenv("ACE_DEAN_PASSWORD", DEFAULT_PASSWORD))
    parser.add_argument("--parent-password", default=os.getenv("ACE_PARENT_PASSWORD", DEFAULT_PASSWORD))
    parser.add_argument("--allow-not-ready", action="store_true", help="Print failures but return success for diagnostics")
    args = parser.parse_args()

    results: list[tuple[str, bool, str]] = []
    parent_case = demo_parent_case()

    status, body = request_json("GET", endpoint(args.base_url, "/health"))
    record(results, "health", status == 200 and isinstance(body, dict) and body.get("status") == "healthy", f"HTTP {status}")

    status, body = request_json("GET", endpoint(args.base_url, "/api/ready"))
    ready_ok = status == 200 and isinstance(body, dict) and body.get("status") == "ready"
    if isinstance(body, dict):
        ready_detail = body.get("reason") or body.get("detail") or body
    else:
        ready_detail = body
    record(results, "business readiness", ready_ok, f"HTTP {status}; {ready_detail or 'ready'}")

    status, body = request_json("GET", endpoint(args.base_url, "/api/openapi.json"))
    record(results, "openapi", status == 200 and isinstance(body, dict) and "paths" in body, f"HTTP {status}")

    status, body = request_json(
        "POST",
        endpoint(args.base_url, "/api/v1/auth/login"),
        {"username": args.dean_username, "password": args.dean_password},
    )
    dean_token = body.get("token") if isinstance(body, dict) else None
    record(results, "dean login", status == 200 and bool(dean_token), f"HTTP {status}; {body if not dean_token else 'token issued'}")

    if dean_token:
        status, body = request_json("GET", endpoint(args.base_url, "/api/v1/auth/me"), token=dean_token)
        record(results, "dean profile", status == 200 and isinstance(body, dict), f"HTTP {status}; {body}")

    status, body = request_json(
        "POST",
        endpoint(args.base_url, "/api/v1/auth/login"),
        {"username": parent_case["parent_username"], "password": args.parent_password},
    )
    parent_account_token = body.get("token") if isinstance(body, dict) else None
    record(
        results,
        "parent account login",
        status == 200 and bool(parent_account_token),
        f"HTTP {status}; {body if not parent_account_token else parent_case['parent_username']}",
    )

    status, body = request_json(
        "POST",
        endpoint(args.base_url, "/api/v1/parents/auth"),
        {
            "student_name": parent_case["student_name"],
            "class_name": parent_case["class_name"],
            "auth_code": parent_case["auth_code"],
        },
    )
    parent_student_token = body.get("token") if isinstance(body, dict) else None
    record(
        results,
        "parent student auth",
        status == 200 and bool(parent_student_token),
        f"HTTP {status}; student {parent_case['student_name']} {parent_case['class_name']}",
    )

    if parent_student_token:
        report_url = endpoint(args.base_url, f"/api/v1/parents/student/{parent_case['student_id']}/report")
        status, body = request_json("GET", report_url, token=parent_student_token)
        report_ok = status == 200 and isinstance(body, dict) and body.get("latest_exam")
        detail = body.get("student_name") if isinstance(body, dict) else body
        record(results, "parent student report", report_ok, f"HTTP {status}; {detail}")

    failed = [label for label, ok, _ in results if not ok]
    if failed:
        print("\nDeployment readiness failed:", ", ".join(failed))
        return 0 if args.allow_not_ready else 1

    print("\nDeployment readiness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
