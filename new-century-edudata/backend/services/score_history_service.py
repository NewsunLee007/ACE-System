import json
import math
import re
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session


SUBJECT_COLUMNS: Tuple[Tuple[str, str], ...] = (
    ("语文", "score_chinese"),
    ("数学", "score_math"),
    ("英语", "score_english"),
    ("科学", "score_science"),
    ("社会", "score_society"),
)

SUBJECT_ALIASES = {
    "chinese": "语文",
    "math": "数学",
    "english": "英语",
    "science": "科学",
    "society": "社会",
    "score_chinese": "语文",
    "score_math": "数学",
    "score_english": "英语",
    "score_science": "科学",
    "score_society": "社会",
}


def to_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def round_float(value: Any, digits: int = 2) -> Optional[float]:
    number = to_float(value)
    return round(number, digits) if number is not None else None


def mean(values: Iterable[Any]) -> float:
    numbers = [number for number in (to_float(value) for value in values) if number is not None]
    return sum(numbers) / len(numbers) if numbers else 0.0


def std(values: Iterable[Any]) -> float:
    numbers = [number for number in (to_float(value) for value in values) if number is not None]
    if not numbers:
        return 0.0
    avg = sum(numbers) / len(numbers)
    return math.sqrt(sum((value - avg) ** 2 for value in numbers) / len(numbers))


def pct(part: int, total: int) -> float:
    return (part / total * 100) if total else 0.0


def class_code(value: Any) -> str:
    return str(value or "").replace("班", "").strip()


def parse_class_id(value: Any) -> Optional[int]:
    match = re.search(r"\d{3,4}", str(value or ""))
    return int(match.group(0)) if match else None


def layer_code_from_value(layer_code: Any = None, layer_name: Any = None) -> str:
    code = str(layer_code or "").strip().upper()
    if code in {"A", "B", "C"}:
        return code
    name = str(layer_name or "").upper()
    if "A" in name:
        return "A"
    if "B" in name:
        return "B"
    if "C" in name:
        return "C"
    return "C"


def parse_subjects(value: Any) -> List[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
    except Exception:
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def normalize_subject(subject: Any) -> str:
    text_value = str(subject or "").strip()
    return SUBJECT_ALIASES.get(text_value.lower(), text_value)


def academic_year_from_exam(term: Any, exam_date: Any = None) -> str:
    term_text = str(term or "").strip()
    match = re.match(r"^(\d{4})-(\d+)$", term_text)
    if match:
        year = int(match.group(1))
        return f"{year}-{year + 1}"

    parsed_year = None
    if isinstance(exam_date, (date, datetime)):
        parsed_year = exam_date.year
    elif exam_date:
        try:
            parsed_year = datetime.fromisoformat(str(exam_date)).year
        except ValueError:
            parsed_year = None
    if parsed_year:
        return f"{parsed_year}-{parsed_year + 1}"
    return ""


def term_in_academic_year(term: Any, academic_year: str) -> bool:
    match = re.match(r"^(\d{4})-(\d{4})$", str(academic_year or "").strip())
    if not match:
        return False
    start_year = match.group(1)
    return str(term or "").startswith(f"{start_year}-")


def percentile_from_rank(rank: Optional[int], count: int) -> Optional[float]:
    if not rank or count <= 1:
        return None
    return ((count - rank) / (count - 1)) * 100


def score_rate(score: Any, full_score: Any) -> Optional[float]:
    score_number = to_float(score)
    full_number = to_float(full_score)
    if score_number is None or not full_number or full_number <= 0:
        return None
    return (score_number / full_number) * 100


def rank_lookup(rows: List[Dict[str, Any]], value_key: str = "total_score") -> Dict[Any, int]:
    ranked = [
        row for row in rows
        if to_float(row.get(value_key)) is not None
    ]
    ranked.sort(key=lambda row: to_float(row.get(value_key)) or 0, reverse=True)
    return {row["student_id"]: index + 1 for index, row in enumerate(ranked)}


class ScoreHistoryService:
    """Build longitudinal score views from exams and score rows."""

    def __init__(self, db: Session):
        self.db = db

    def _in_clause(self, field: str, values: List[Any], prefix: str, params: Dict[str, Any]) -> str:
        placeholders = []
        for index, value in enumerate(values):
            key = f"{prefix}_{index}"
            params[key] = value
            placeholders.append(f":{key}")
        return f"{field} IN ({', '.join(placeholders)})"

    def fetch_exams(
        self,
        grade_level: str,
        mode: str = "recent",
        term: Optional[str] = None,
        academic_year: Optional[str] = None,
        limit: int = 6,
    ) -> List[Dict[str, Any]]:
        rows = self.db.execute(text("""
            SELECT id, exam_name, term, exam_type, grade_level, exam_date, subjects, full_score
            FROM biz_exams
            WHERE grade_level = :grade_level
            ORDER BY exam_date DESC, id DESC
        """), {"grade_level": grade_level}).fetchall()

        exams = [dict(row._mapping) for row in rows]
        selected_mode = mode or "recent"
        if selected_mode == "term" and term:
            exams = [exam for exam in exams if exam.get("term") == term]
        elif selected_mode == "academic_year" and academic_year:
            exams = [exam for exam in exams if term_in_academic_year(exam.get("term"), academic_year)]
        elif selected_mode == "recent":
            exams = exams[:max(1, min(int(limit or 6), 12))]
        elif selected_mode != "all":
            exams = exams[:max(1, min(int(limit or 6), 12))]

        return list(reversed(exams))

    def _fetch_layer_lookup(self, grade_level: str, exam_ids: List[int]) -> Dict[Tuple[Any, str], str]:
        lookup: Dict[Tuple[Any, str], str] = {}

        if exam_ids:
            params: Dict[str, Any] = {}
            detail_clause = self._in_clause("cl.exam_id", exam_ids, "layer_exam", params)
            try:
                rows = self.db.execute(text(f"""
                    SELECT cl.exam_id, cl.layer_code, cl.layer_name, cld.class_name
                    FROM biz_class_layers cl
                    JOIN biz_class_layer_details cld ON cld.layer_id = cl.id
                    WHERE {detail_clause}
                """), params).fetchall()
                for row in rows:
                    lookup[(row.exam_id, class_code(row.class_name))] = layer_code_from_value(row.layer_code, row.layer_name)
            except Exception:
                pass

        rows = self.db.execute(text("""
            SELECT grade_level, term, class_name, class_id, layer_code, layer_name
            FROM biz_class_layers
            WHERE grade_level = :grade_level
              AND (class_name IS NOT NULL OR class_id IS NOT NULL)
        """), {"grade_level": grade_level}).fetchall()
        for row in rows:
            class_name = class_code(row.class_name or row.class_id)
            if not class_name:
                continue
            code = layer_code_from_value(row.layer_code, row.layer_name)
            lookup[(row.term or "any", class_name)] = code
            lookup[("any", class_name)] = code

        return lookup

    def fetch_score_records(self, exams: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        exam_ids = [int(exam["id"]) for exam in exams]
        if not exam_ids:
            return []

        grade_level = str(exams[0].get("grade_level") or "")
        exam_by_id = {int(exam["id"]): exam for exam in exams}
        layer_lookup = self._fetch_layer_lookup(grade_level, exam_ids)
        params: Dict[str, Any] = {}
        score_clause = self._in_clause("s.exam_id", exam_ids, "score_exam", params)

        rows = self.db.execute(text(f"""
            SELECT
              s.exam_id,
              s.student_id,
              st.name AS student_name,
              st.student_code,
              s.exam_number,
              s.class_name,
              s.score_chinese,
              s.score_math,
              s.score_english,
              s.score_science,
              s.score_society,
              s.total_score,
              s.is_included
            FROM biz_scores s
            LEFT JOIN biz_students st ON st.id = s.student_id
            WHERE {score_clause}
              AND s.is_included = 1
            ORDER BY s.exam_id, s.class_name, s.total_score DESC
        """), params).fetchall()

        records = []
        for row in rows:
            exam = exam_by_id.get(int(row.exam_id), {})
            subjects = parse_subjects(exam.get("subjects")) or [label for label, _ in SUBJECT_COLUMNS]
            class_name = class_code(row.class_name)
            layer_code = (
                layer_lookup.get((row.exam_id, class_name))
                or layer_lookup.get((exam.get("term"), class_name))
                or layer_lookup.get(("any", class_name))
                or "C"
            )
            score_map = {}
            for label, column in SUBJECT_COLUMNS:
                if subjects and label not in subjects:
                    continue
                value = to_float(getattr(row, column))
                if value is not None:
                    score_map[label] = value
            full_score = to_float(exam.get("full_score")) or max(1, len(score_map) * 100)
            records.append({
                "exam_id": int(row.exam_id),
                "exam_name": exam.get("exam_name") or f"考试{row.exam_id}",
                "term": exam.get("term") or "",
                "academic_year": academic_year_from_exam(exam.get("term"), exam.get("exam_date")),
                "exam_date": exam.get("exam_date").isoformat() if hasattr(exam.get("exam_date"), "isoformat") else (exam.get("exam_date") or ""),
                "grade_level": exam.get("grade_level") or "",
                "subjects_config": subjects,
                "full_score": full_score,
                "student_id": int(row.student_id),
                "student_name": row.student_name or "",
                "student_code": row.student_code or "",
                "exam_number": row.exam_number or "",
                "class_name": class_name,
                "class_id": parse_class_id(class_name),
                "layer_code": layer_code,
                "scores": score_map,
                "total_score": to_float(row.total_score),
            })

        return self.add_rank_metrics(records)

    def add_rank_metrics(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        previous_by_student: Dict[int, Dict[str, Any]] = {}
        enriched: List[Dict[str, Any]] = []

        by_exam: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        for row in records:
            by_exam[int(row["exam_id"])].append(row)

        for exam_id in sorted(by_exam.keys(), key=lambda value: min(row.get("exam_date") or "" for row in by_exam[value])):
            exam_rows = by_exam[exam_id]
            grade_scores = [row["total_score"] for row in exam_rows if row.get("total_score") is not None]
            grade_mean = mean(grade_scores)
            grade_std = std(grade_scores)
            grade_ranks = rank_lookup(exam_rows)

            class_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            layer_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
            for row in exam_rows:
                class_groups[row.get("class_name") or ""].append(row)
                layer_groups[row.get("layer_code") or "C"].append(row)

            class_ranks = {class_name: rank_lookup(rows) for class_name, rows in class_groups.items()}
            layer_ranks = {layer_code: rank_lookup(rows) for layer_code, rows in layer_groups.items()}
            class_means = {
                class_name: mean(row.get("total_score") for row in rows)
                for class_name, rows in class_groups.items()
            }
            layer_means = {
                layer_code: mean(row.get("total_score") for row in rows)
                for layer_code, rows in layer_groups.items()
            }

            subject_grade_values: Dict[str, List[float]] = defaultdict(list)
            subject_class_values: Dict[Tuple[str, str], List[float]] = defaultdict(list)
            subject_layer_values: Dict[Tuple[str, str], List[float]] = defaultdict(list)
            for row in exam_rows:
                for subject, value in (row.get("scores") or {}).items():
                    subject_grade_values[subject].append(value)
                    subject_class_values[(row.get("class_name") or "", subject)].append(value)
                    subject_layer_values[(row.get("layer_code") or "C", subject)].append(value)

            for row in sorted(exam_rows, key=lambda item: item.get("total_score") or 0, reverse=True):
                student_id = row["student_id"]
                class_name = row.get("class_name") or ""
                layer_code = row.get("layer_code") or "C"
                grade_rank = grade_ranks.get(student_id)
                class_rank = class_ranks.get(class_name, {}).get(student_id)
                layer_rank = layer_ranks.get(layer_code, {}).get(student_id)
                full_score = row.get("full_score") or 1
                total = row.get("total_score")
                previous = previous_by_student.get(student_id)
                subject_payload = {}
                subject_count = len(row.get("subjects_config") or row.get("scores") or []) or 1
                subject_full = full_score / subject_count if subject_count else 100
                for subject, value in (row.get("scores") or {}).items():
                    grade_subject_mean = mean(subject_grade_values.get(subject, []))
                    class_subject_mean = mean(subject_class_values.get((class_name, subject), []))
                    layer_subject_mean = mean(subject_layer_values.get((layer_code, subject), []))
                    previous_subject = (previous or {}).get("subjects", {}).get(subject, {})
                    subject_payload[subject] = {
                        "score": round_float(value, 1),
                        "full_score": round_float(subject_full, 1),
                        "score_rate": round_float(score_rate(value, subject_full), 1),
                        "grade_mean": round_float(grade_subject_mean, 1),
                        "class_mean": round_float(class_subject_mean, 1),
                        "layer_mean": round_float(layer_subject_mean, 1),
                        "gap_to_grade_mean": round_float(value - grade_subject_mean, 1),
                        "gap_to_layer_mean": round_float(value - layer_subject_mean, 1),
                        "score_delta": round_float(value - previous_subject.get("score"), 1) if previous_subject.get("score") is not None else None,
                    }

                grade_percentile = percentile_from_rank(grade_rank, len(exam_rows))
                z_value = (total - grade_mean) / grade_std if total is not None and grade_std > 0 else 0
                payload = {
                    **row,
                    "subjects": subject_payload,
                    "total": {
                        "score": round_float(total, 1),
                        "full_score": round_float(full_score, 1),
                        "score_rate": round_float(score_rate(total, full_score), 1),
                        "grade_mean": round_float(grade_mean, 1),
                        "class_mean": round_float(class_means.get(class_name), 1),
                        "layer_mean": round_float(layer_means.get(layer_code), 1),
                        "gap_to_grade_mean": round_float((total or 0) - grade_mean, 1) if total is not None else None,
                        "gap_to_layer_mean": round_float((total or 0) - layer_means.get(layer_code, 0), 1) if total is not None else None,
                        "grade_rank": grade_rank,
                        "class_rank": class_rank,
                        "layer_rank": layer_rank,
                        "grade_percentile": round_float(grade_percentile, 1),
                        "participants": len(exam_rows),
                        "layer_participants": len(layer_groups.get(layer_code, [])),
                    },
                    "z_value": round_float(z_value, 2),
                    "changes": {
                        "score_delta": round_float(total - previous["total"]["score"], 1) if previous and total is not None and previous.get("total", {}).get("score") is not None else None,
                        "score_rate_delta": round_float((score_rate(total, full_score) or 0) - (previous.get("total", {}).get("score_rate") or 0), 1) if previous and total is not None else None,
                        "z_delta": round_float(z_value - (previous.get("z_value") or 0), 2) if previous else None,
                        "rank_change": (previous.get("total", {}).get("grade_rank") - grade_rank) if previous and grade_rank and previous.get("total", {}).get("grade_rank") else None,
                        "percentile_change": round_float((grade_percentile or 0) - (previous.get("total", {}).get("grade_percentile") or 0), 1) if previous and grade_percentile is not None else None,
                    },
                }
                previous_by_student[student_id] = payload
                enriched.append(payload)

        return enriched

    def build_student_history(
        self,
        student_id: int,
        mode: str = "recent",
        term: Optional[str] = None,
        academic_year: Optional[str] = None,
        limit: int = 6,
    ) -> Dict[str, Any]:
        student = self.db.execute(text("""
            SELECT id, name, student_code, class_name, class_id, grade_level
            FROM biz_students
            WHERE id = :student_id
        """), {"student_id": student_id}).fetchone()
        if not student:
            return {"success": False, "message": "学生不存在", "data": None}

        grade_level = student.grade_level or (f"{str(student.class_id)[0]}年级" if student.class_id else "")
        exams = self.fetch_exams(grade_level, mode=mode, term=term, academic_year=academic_year, limit=limit)
        records = [
            row for row in self.fetch_score_records(exams)
            if int(row.get("student_id")) == int(student_id)
        ]
        records.sort(key=lambda row: (row.get("exam_date") or "", row.get("exam_id") or 0))
        exam_scores = list(reversed(records))
        return {
            "success": True,
            "entity_type": "student",
            "mode": mode,
            "student": {
                "id": student.id,
                "name": student.name,
                "student_code": student.student_code,
                "class_name": class_code(student.class_name or student.class_id),
                "class_id": student.class_id,
                "grade_level": grade_level,
            },
            "total_exams": len(exam_scores),
            "records": records,
            "exam_scores": exam_scores,
            "summary": self._student_summary(exam_scores),
        }

    def _student_summary(self, exam_scores: List[Dict[str, Any]]) -> Dict[str, Any]:
        latest = exam_scores[0] if exam_scores else None
        previous = exam_scores[1] if len(exam_scores) > 1 else None
        if not latest:
            return {"trend_direction": "none", "message": "暂无历史成绩"}
        score_delta = latest.get("changes", {}).get("score_delta")
        z_delta = latest.get("changes", {}).get("z_delta")
        direction = "stable"
        if (score_delta or 0) > 3 or (z_delta or 0) > 0.1:
            direction = "up"
        elif (score_delta or 0) < -3 or (z_delta or 0) < -0.1:
            direction = "down"
        weak_subjects = []
        for subject, value in (latest.get("subjects") or {}).items():
            if (value.get("score_rate") or 0) < 75 or (value.get("gap_to_layer_mean") or 0) < -3:
                weak_subjects.append({
                    "subject": subject,
                    "score": value.get("score"),
                    "score_rate": value.get("score_rate"),
                    "gap_to_layer_mean": value.get("gap_to_layer_mean"),
                    "score_delta": value.get("score_delta"),
                })
        weak_subjects.sort(key=lambda item: ((item.get("gap_to_layer_mean") or 0), (item.get("score_rate") or 0)))
        return {
            "trend_direction": direction,
            "latest_exam": latest.get("exam_name"),
            "previous_exam": previous.get("exam_name") if previous else None,
            "score_delta": score_delta,
            "z_delta": z_delta,
            "rank_change": latest.get("changes", {}).get("rank_change"),
            "weak_subjects": weak_subjects[:3],
        }

    def build_grade_history(self, grade_level: str, mode: str = "recent", term: Optional[str] = None, academic_year: Optional[str] = None, limit: int = 6) -> Dict[str, Any]:
        exams = self.fetch_exams(grade_level, mode=mode, term=term, academic_year=academic_year, limit=limit)
        records = self.fetch_score_records(exams)
        by_exam: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
        for row in records:
            by_exam[row["exam_id"]].append(row)
        trend_rows = []
        for exam in exams:
            rows = by_exam.get(int(exam["id"]), [])
            totals = [row.get("total_score") for row in rows if row.get("total_score") is not None]
            full_score = to_float(exam.get("full_score")) or 1
            trend_rows.append({
                "exam_id": exam["id"],
                "exam_name": exam["exam_name"],
                "term": exam.get("term"),
                "academic_year": academic_year_from_exam(exam.get("term"), exam.get("exam_date")),
                "exam_date": exam.get("exam_date").isoformat() if hasattr(exam.get("exam_date"), "isoformat") else (exam.get("exam_date") or ""),
                "participants": len(totals),
                "mean": round_float(mean(totals), 1),
                "score_rate": round_float(score_rate(mean(totals), full_score), 1),
                "std": round_float(std(totals), 2),
                "pass_rate": round_float(pct(len([value for value in totals if value >= full_score * 0.6]), len(totals)), 1),
            })
        return {"success": True, "entity_type": "grade", "grade_level": grade_level, "mode": mode, "total_exams": len(trend_rows), "records": trend_rows}

    def build_class_history(self, class_name: str, mode: str = "recent", term: Optional[str] = None, academic_year: Optional[str] = None, limit: int = 6) -> Dict[str, Any]:
        grade_level = f"{class_code(class_name)[0]}年级" if class_code(class_name)[:1].isdigit() else ""
        exams = self.fetch_exams(grade_level, mode=mode, term=term, academic_year=academic_year, limit=limit)
        records = self.fetch_score_records(exams)
        class_key = class_code(class_name)
        trend_rows = []
        for exam in exams:
            exam_rows = [row for row in records if row["exam_id"] == int(exam["id"])]
            class_rows = [row for row in exam_rows if class_code(row.get("class_name")) == class_key]
            if not class_rows:
                continue
            totals = [row.get("total_score") for row in class_rows if row.get("total_score") is not None]
            grade_totals = [row.get("total_score") for row in exam_rows if row.get("total_score") is not None]
            layer_code = class_rows[0].get("layer_code") or "C"
            layer_rows = [row for row in exam_rows if row.get("layer_code") == layer_code]
            layer_totals = [row.get("total_score") for row in layer_rows if row.get("total_score") is not None]
            class_mean = mean(totals)
            grade_mean = mean(grade_totals)
            same_layer_mean = mean(layer_totals)
            grade_std = std(grade_totals)
            trend_rows.append({
                "exam_id": exam["id"],
                "exam_name": exam["exam_name"],
                "term": exam.get("term"),
                "academic_year": academic_year_from_exam(exam.get("term"), exam.get("exam_date")),
                "exam_date": exam.get("exam_date").isoformat() if hasattr(exam.get("exam_date"), "isoformat") else (exam.get("exam_date") or ""),
                "class_name": class_key,
                "layer_code": layer_code,
                "participants": len(totals),
                "class_mean": round_float(class_mean, 1),
                "grade_mean": round_float(grade_mean, 1),
                "same_layer_mean": round_float(same_layer_mean, 1),
                "range_diff": round_float(class_mean - grade_mean, 1),
                "same_layer_diff": round_float(class_mean - same_layer_mean, 1),
                "z_value": round_float((class_mean - grade_mean) / grade_std if grade_std > 0 else 0, 2),
            })
        return {"success": True, "entity_type": "class", "class_name": class_key, "mode": mode, "total_exams": len(trend_rows), "records": trend_rows}

    def build_subject_history(self, grade_level: str, subject: str, mode: str = "recent", term: Optional[str] = None, academic_year: Optional[str] = None, limit: int = 6) -> Dict[str, Any]:
        normalized_subject = normalize_subject(subject)
        exams = self.fetch_exams(grade_level, mode=mode, term=term, academic_year=academic_year, limit=limit)
        records = self.fetch_score_records(exams)
        trend_rows = []
        for exam in exams:
            exam_rows = [row for row in records if row["exam_id"] == int(exam["id"])]
            values = [row["subjects"][normalized_subject]["score"] for row in exam_rows if normalized_subject in row.get("subjects", {})]
            subject_count = len(parse_subjects(exam.get("subjects")) or SUBJECT_COLUMNS)
            full_score = (to_float(exam.get("full_score")) or 500) / max(1, subject_count)
            trend_rows.append({
                "exam_id": exam["id"],
                "exam_name": exam["exam_name"],
                "term": exam.get("term"),
                "academic_year": academic_year_from_exam(exam.get("term"), exam.get("exam_date")),
                "exam_date": exam.get("exam_date").isoformat() if hasattr(exam.get("exam_date"), "isoformat") else (exam.get("exam_date") or ""),
                "subject": normalized_subject,
                "participants": len(values),
                "mean": round_float(mean(values), 1),
                "score_rate": round_float(score_rate(mean(values), full_score), 1),
                "pass_rate": round_float(pct(len([value for value in values if value >= full_score * 0.6]), len(values)), 1),
            })
        return {"success": True, "entity_type": "subject", "grade_level": grade_level, "subject": normalized_subject, "mode": mode, "total_exams": len(trend_rows), "records": trend_rows}

    def fetch_teacher_relations(self, teacher_id: int) -> List[Dict[str, Any]]:
        rows = self.db.execute(text("""
            SELECT teacher_id, term, grade_name, class_name, subject_name, is_headmaster
            FROM biz_teacher_class_rel
            WHERE teacher_id = :teacher_id
        """), {"teacher_id": teacher_id}).fetchall()
        return [dict(row._mapping) for row in rows]

    def build_teacher_history(self, teacher_id: int, mode: str = "recent", term: Optional[str] = None, academic_year: Optional[str] = None, limit: int = 6) -> Dict[str, Any]:
        relations = self.fetch_teacher_relations(teacher_id)
        grades = sorted({relation.get("grade_name") for relation in relations if relation.get("grade_name")})
        all_rows = []
        for grade_level in grades:
            exams = self.fetch_exams(grade_level, mode=mode, term=term, academic_year=academic_year, limit=limit)
            records = self.fetch_score_records(exams)
            for exam in exams:
                exam_relations = [
                    relation for relation in relations
                    if relation.get("grade_name") == grade_level and relation.get("term") == exam.get("term")
                ]
                if not exam_relations:
                    continue
                scoped_records = []
                for relation in exam_relations:
                    class_name = class_code(relation.get("class_name"))
                    subject = normalize_subject(relation.get("subject_name"))
                    scoped_records.extend([
                        {**row, "_teacher_subject": subject}
                        for row in records
                        if row["exam_id"] == int(exam["id"]) and class_code(row.get("class_name")) == class_name
                    ])
                if not scoped_records:
                    continue
                subject_values = []
                total_values = []
                subjects = sorted({row.get("_teacher_subject") for row in scoped_records if row.get("_teacher_subject")})
                for row in scoped_records:
                    total_values.append(row.get("total_score"))
                    subject = row.get("_teacher_subject")
                    if subject and subject in row.get("subjects", {}):
                        subject_values.append(row["subjects"][subject]["score"])
                metric_values = subject_values or total_values
                all_rows.append({
                    "exam_id": exam["id"],
                    "exam_name": exam["exam_name"],
                    "term": exam.get("term"),
                    "academic_year": academic_year_from_exam(exam.get("term"), exam.get("exam_date")),
                    "exam_date": exam.get("exam_date").isoformat() if hasattr(exam.get("exam_date"), "isoformat") else (exam.get("exam_date") or ""),
                    "grade_level": grade_level,
                    "classes": sorted({class_code(relation.get("class_name")) for relation in exam_relations}),
                    "subjects": subjects,
                    "participants": len(metric_values),
                    "mean": round_float(mean(metric_values), 1),
                    "diagnosis": "上升关注" if len(metric_values) and mean(metric_values) >= 75 else "需要跟进",
                })
        all_rows.sort(key=lambda row: (row.get("exam_date") or "", row.get("exam_id") or ""))
        if mode == "recent":
            all_rows = all_rows[-max(1, min(int(limit or 6), 12)):]
        return {"success": True, "entity_type": "teacher", "teacher_id": teacher_id, "mode": mode, "total_exams": len(all_rows), "records": all_rows}
