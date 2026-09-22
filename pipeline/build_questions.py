"""Parse the ISSAP practice-exam PDFs and answer key into per-domain JSON question banks.

Run from a shell where `pdftotext` resolves (e.g. Git Bash):
    python3 pipeline/build_questions.py
"""
import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GIT_PDFTOTEXT_FALLBACK = r"C:\Program Files\Git\mingw64\bin\pdftotext.exe"

DOMAIN_NAMES = {
    "D1": "Governance, Risk, and Compliance",
    "D2": "Security Architecture Modeling",
    "D3": "Infrastructure and System Security Architecture",
    "D4": "Identity and Access Management Architecture",
}
DOMAIN_NAME_TO_CODE = {
    "Governance, Risk, and Compliance": "D1",
    "Security Architecture Modeling": "D2",
    "Infrastructure and System Security Architecture": "D3",
    "Infrastructure & System Security Architecture": "D3",
    "Identity and Access Management Architecture": "D4",
}
DIFFICULTY_POINTS = {"Easy": 6, "Moderate": 8, "Challenging": 10}
# Verified by hand against the answer key's Quick-Reference tables across all 4 exams.
EXPECTED_CROSSTAB = {
    "D1": {"Easy": 48, "Moderate": 35, "Challenging": 21},
    "D2": {"Easy": 25, "Moderate": 56, "Challenging": 31},
    "D3": {"Easy": 22, "Moderate": 101, "Challenging": 37},
    "D4": {"Easy": 25, "Moderate": 68, "Challenging": 31},
}

HEADER_FOOTER_PATTERNS = [
    re.compile(r"^\s*\d{1,4}\s*$"),
    re.compile(r"^\s*ISSAP Practice Exam \d+ \| \(ISC\)2 Information Systems Security Architecture Professional\s*$"),
    re.compile(r"^\s*Answer Key \| \(ISC\)2 ISSAP Practice Exam Series\s*$"),
]
QUICKREF_SECTION_RE = re.compile(r"PRACTICE EXAM (\d) \W+ ANSWER KEY")
QUICKREF_ROW_RE = re.compile(r"^\s*(\d{1,3})\s+([A-D])\s+(D[1-4])\s+(Easy|Moderate|Challenging)\s*$")
DETAIL_SECTION_RE = re.compile(r"^Exam (\d) \W+ Detailed Explanations\s*$")
DETAIL_HEADER_RE = re.compile(
    r"^Question (\d+) \| (.+?)\W+(Easy|Moderate|Challenging)\W+(\d+)\s*pts\W+Correct:\s*([A-D])\s*$"
)
EXAM_QUESTION_HEADER_RE = re.compile(r"^Question (\d+)$")
OPTION_START_RE = re.compile(r"^(\u2713\s*)?([A-D])\.\s*(.*)$")


def find_pdftotext():
    found = shutil.which("pdftotext")
    if found:
        return found
    if Path(GIT_PDFTOTEXT_FALLBACK).exists():
        return GIT_PDFTOTEXT_FALLBACK
    raise RuntimeError(
        "pdftotext not found on PATH and not at the expected Git for Windows location "
        f"({GIT_PDFTOTEXT_FALLBACK}). Run this script from Git Bash, or install poppler/xpdf utils."
    )


def extract_text(pdftotext_exe, pdf_path, layout=False, table=False, utf8=False):
    with tempfile.TemporaryDirectory() as tmp_dir:
        out_path = Path(tmp_dir) / "out.txt"
        args = [pdftotext_exe]
        if table:
            args.append("-table")
        elif layout:
            args.append("-layout")
        if utf8:
            args += ["-enc", "UTF-8"]
        args += [str(pdf_path), str(out_path)]
        subprocess.run(args, check=True)
        return out_path.read_text(encoding="utf-8")


def strip_noise(lines):
    return [line for line in lines if not any(p.match(line) for p in HEADER_FOOTER_PATTERNS)]


def reflow(strings):
    """Join stripped line fragments: keep a trailing hyphen glued (line-wrap), else space-join."""
    out = ""
    for s in strings:
        if not s:
            continue
        if not out:
            out = s
        elif out.endswith("-"):
            out += s
        else:
            out += " " + s
    return out


def parse_quickref(text):
    """Returns {exam: {q_num: (answer, domain, difficulty)}}."""
    sections = QUICKREF_SECTION_RE.split(text)
    # sections = [preamble, "1", body1, "2", body2, "3", body3, "4", body4]
    result = {}
    for i in range(1, len(sections), 2):
        exam = int(sections[i])
        body = sections[i + 1]
        rows = {}
        for line in body.splitlines():
            m = QUICKREF_ROW_RE.match(line)
            if not m:
                continue
            q_num = int(m.group(1))
            if q_num in rows:
                continue  # first occurrence only; avoids picking up stray matches past 125
            rows[q_num] = (m.group(2), m.group(3), m.group(4))
            if len(rows) >= 125:
                break
        result[exam] = rows
    return result


def parse_option_block(lines, allow_checkmark, allow_explanation):
    stem_lines = []
    options = {"A": [], "B": [], "C": [], "D": []}
    explanation_lines = []
    order = ["A", "B", "C", "D"]
    expected_idx = 0
    current_target = "stem"
    checkmark_letter = None
    in_explanation = False

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if allow_explanation and line.startswith("Explanation:"):
            in_explanation = True
            explanation_lines.append(line[len("Explanation:"):].strip())
            continue
        if not in_explanation:
            m = OPTION_START_RE.match(line)
            if m and expected_idx < 4 and m.group(2) == order[expected_idx]:
                if allow_checkmark and m.group(1):
                    checkmark_letter = m.group(2)
                current_target = m.group(2)
                options[current_target].append(m.group(3))
                expected_idx += 1
                continue
        if in_explanation:
            explanation_lines.append(line)
        elif current_target == "stem":
            stem_lines.append(line)
        else:
            options[current_target].append(line)

    return {
        "stem": reflow(stem_lines),
        "options": {k: reflow(v) for k, v in options.items()},
        "explanation": reflow(explanation_lines) if allow_explanation else None,
        "checkmark_letter": checkmark_letter,
    }


def parse_detailed_explanations(text):
    """Returns {exam: {q_num: record}} with stem/options/domainName/difficulty/points/correct/explanation/checkmark."""
    lines = strip_noise(text.splitlines())
    section_starts = [(i, m) for i, l in enumerate(lines) for m in [DETAIL_SECTION_RE.match(l)] if m]
    # A "Detailed Explanations" section is followed, before the next such section, by the next
    # exam's Quick-Reference Answer Table (PRACTICE EXAM N -- ANSWER KEY). That table must also
    # act as a hard stop, or the last question's block swallows the whole next table as its
    # "explanation".
    other_boundaries = [i for i, l in enumerate(lines) if QUICKREF_SECTION_RE.search(l)]
    all_boundaries = sorted({i for i, _ in section_starts} | set(other_boundaries))
    result = {}
    for idx, (start_line, m) in enumerate(section_starts):
        exam = int(m.group(1))
        later = [b for b in all_boundaries if b > start_line]
        end_line = later[0] if later else len(lines)
        section_lines = lines[start_line + 1:end_line]

        headers = [(i, DETAIL_HEADER_RE.match(l)) for i, l in enumerate(section_lines)]
        headers = [(i, hm) for i, hm in headers if hm]

        records = {}
        for h_idx, (line_idx, hm) in enumerate(headers):
            q_num = int(hm.group(1))
            domain_name_raw = hm.group(2).strip()
            difficulty = hm.group(3)
            points = int(hm.group(4))
            correct = hm.group(5)
            block_end = headers[h_idx + 1][0] if h_idx + 1 < len(headers) else len(section_lines)
            block_lines = section_lines[line_idx + 1:block_end]
            parsed = parse_option_block(block_lines, allow_checkmark=True, allow_explanation=True)
            records[q_num] = {
                "domainNameRaw": domain_name_raw,
                "difficulty": difficulty,
                "points": points,
                "correct": correct,
                **parsed,
            }
        result[exam] = records
    return result


def parse_exam_pdf(text):
    """Returns {q_num: {stem, options}} for cross-checking against the answer key."""
    lines = strip_noise(text.splitlines())
    headers = [(i, EXAM_QUESTION_HEADER_RE.match(l)) for i, l in enumerate(lines)]
    headers = [(i, hm) for i, hm in headers if hm]
    records = {}
    for h_idx, (line_idx, hm) in enumerate(headers):
        q_num = int(hm.group(1))
        block_end = headers[h_idx + 1][0] if h_idx + 1 < len(headers) else len(lines)
        block_lines = lines[line_idx + 1:block_end]
        parsed = parse_option_block(block_lines, allow_checkmark=False, allow_explanation=False)
        records[q_num] = parsed
    return records


def build(source_dir: Path, out_dir: Path, report_path: Path):
    pdftotext_exe = find_pdftotext()
    answer_key_pdf = source_dir / "context" / "zz. ISSAP Practice Exam Answer Key and Scoring Sheets.pdf"
    exam_pdfs = {
        n: source_dir / "study guides" / f"yy. ISSAP Practice Exam {n}.pdf" for n in (1, 2, 3, 4)
    }
    for p in [answer_key_pdf, *exam_pdfs.values()]:
        if not p.exists():
            raise FileNotFoundError(p)

    print("Extracting answer key (table mode)...")
    quickref_text = extract_text(pdftotext_exe, answer_key_pdf, table=True, utf8=True)
    quickref = parse_quickref(quickref_text)

    print("Extracting answer key (layout mode, detailed explanations)...")
    detail_text = extract_text(pdftotext_exe, answer_key_pdf, layout=True, utf8=True)
    details = parse_detailed_explanations(detail_text)

    exam_texts = {}
    for n, pdf_path in exam_pdfs.items():
        print(f"Extracting exam {n} (layout mode)...")
        exam_texts[n] = parse_exam_pdf(extract_text(pdftotext_exe, pdf_path, layout=True, utf8=True))

    all_records = []
    flags_by_id = {}
    crosstab = {code: {"Easy": 0, "Moderate": 0, "Challenging": 0} for code in DOMAIN_NAMES}

    for exam in (1, 2, 3, 4):
        qref_rows = quickref.get(exam, {})
        detail_rows = details.get(exam, {})
        exam_rows = exam_texts.get(exam, {})

        for q_num in range(1, 126):
            record_id = f"e{exam}q{q_num:03d}"
            flags = []

            qref = qref_rows.get(q_num)
            detail = detail_rows.get(q_num)
            exam_q = exam_rows.get(q_num)

            if qref is None:
                flags.append("missing_quickref_row")
            if detail is None:
                flags.append("missing_detail_block")
            if exam_q is None:
                flags.append("missing_exam_block")

            if qref is None or detail is None or exam_q is None:
                flags_by_id[record_id] = flags
                continue

            qref_answer, qref_domain, qref_difficulty = qref
            domain = qref_domain
            domain_name = DOMAIN_NAMES[domain]

            detail_domain = DOMAIN_NAME_TO_CODE.get(detail["domainNameRaw"])
            if detail_domain != domain:
                flags.append(f"domain_mismatch qref={domain} detail={detail['domainNameRaw']!r}")

            if detail["difficulty"] != qref_difficulty:
                flags.append(f"difficulty_mismatch qref={qref_difficulty} detail={detail['difficulty']}")

            difficulty = qref_difficulty
            expected_points = DIFFICULTY_POINTS[difficulty]
            if detail["points"] != expected_points:
                flags.append(f"points_mismatch expected={expected_points} detail={detail['points']}")

            answers_seen = {qref_answer, detail["correct"]}
            if detail["checkmark_letter"]:
                answers_seen.add(detail["checkmark_letter"])
            if len(answers_seen) != 1:
                flags.append(f"answer_mismatch qref={qref_answer} detail_correct={detail['correct']} checkmark={detail['checkmark_letter']}")
            correct = qref_answer

            options = detail["options"]
            for letter in "ABCD":
                if not options.get(letter):
                    flags.append(f"empty_option_{letter}")
            if not detail["stem"]:
                flags.append("empty_stem")
            if not detail["explanation"]:
                flags.append("empty_explanation")

            if exam_q["stem"]:
                a = re.sub(r"\s+", " ", detail["stem"].lower()).strip()
                b = re.sub(r"\s+", " ", exam_q["stem"].lower()).strip()
                ratio = difflib.SequenceMatcher(None, a, b).ratio()
                if ratio < 0.90:
                    flags.append(f"stem_mismatch ratio={ratio:.2f}")
            else:
                flags.append("exam_stem_unavailable")

            record = {
                "id": record_id,
                "exam": exam,
                "examQuestionNumber": q_num,
                "domain": domain,
                "domainName": domain_name,
                "difficulty": difficulty,
                "points": expected_points,
                "stem": detail["stem"],
                "options": options,
                "correct": correct,
                "explanation": detail["explanation"],
                "flags": flags,
            }
            all_records.append(record)
            if flags:
                flags_by_id[record_id] = flags
            else:
                crosstab[domain][difficulty] += 1

    ids = [r["id"] for r in all_records]
    duplicate_ids = sorted({i for i in ids if ids.count(i) > 1})
    if duplicate_ids:
        flags_by_id["__global__"] = flags_by_id.get("__global__", []) + [f"duplicate_ids: {duplicate_ids}"]

    if len(all_records) != 500:
        flags_by_id["__global__"] = flags_by_id.get("__global__", []) + [
            f"expected 500 total question records, got {len(all_records)}"
        ]

    crosstab_ok = crosstab == EXPECTED_CROSSTAB
    if not crosstab_ok:
        flags_by_id["__global__"] = flags_by_id.get("__global__", []) + [
            f"crosstab mismatch: expected {EXPECTED_CROSSTAB}, got {crosstab}"
        ]

    out_dir.mkdir(parents=True, exist_ok=True)
    by_domain = {code: [] for code in DOMAIN_NAMES}
    for r in all_records:
        by_domain[r["domain"]].append(r)

    domain_file_names = {"D1": "d1_grc.json", "D2": "d2_sam.json", "D3": "d3_issa.json", "D4": "d4_iam.json"}
    manifest = []
    for code, file_name in domain_file_names.items():
        records = by_domain[code]
        (out_dir / file_name).write_text(json.dumps(records, indent=2), encoding="utf-8")
        manifest.append({
            "domain": code,
            "name": DOMAIN_NAMES[code],
            "file": file_name,
            "questionCount": len(records),
            "maxPoints": sum(r["points"] for r in records),
        })
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    report = {
        "totalRecords": len(all_records),
        "crosstab": crosstab,
        "crosstabExpected": EXPECTED_CROSSTAB,
        "crosstabOk": crosstab_ok,
        "flaggedCount": len(flags_by_id),
        "flags": flags_by_id,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Wrote {len(all_records)} records across {len(domain_file_names)} domain files to {out_dir}")
    print(f"Crosstab OK: {crosstab_ok}")
    print(f"Flagged records: {len(flags_by_id)} (see {report_path})")

    return len(flags_by_id) == 0 and crosstab_ok and len(all_records) == 500


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", default=str(ROOT))
    parser.add_argument("--out-dir", default=str(ROOT / "data" / "questions"))
    parser.add_argument("--report", default=str(ROOT / "pipeline" / "validation_report.json"))
    args = parser.parse_args()

    ok = build(Path(args.source_dir), Path(args.out_dir), Path(args.report))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
