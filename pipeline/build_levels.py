"""Bin-pack validated question data into city levels and boss phases per domain.

Run after build_questions.py has produced clean data/questions/*.json:
    python3 pipeline/build_levels.py
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CITY_TARGET_SIZE = 11
BOSS_PHASE_TARGET_SIZE = 9.5

# Fictitious names alluding to each domain's subject matter, assigned in level order.
# Lists are sized with a little slack over the current bin-packed counts; build()
# falls back to a generic "City N" / "Boss Phase N" name if a list ever runs short.
CITY_NAMES = {
    "D1": ["Compliancetown", "Auditburg", "Riskford", "Policyville", "Frameworkhaven",
           "Redline Ridge", "Controlsberg", "Mandateport", "Evidenceville"],
    "D2": ["Blueprintbury", "Patternfield", "Threat Model Heights", "Zonington",
           "Layersburg", "Diagramhaven", "Referencetown", "Modelport"],
    "D3": ["Firewallton", "Segmentville", "Patchburg", "Hardenhurst", "Redundancy Ridge",
           "Uptimeburg", "Failoverfield", "Backuptown", "Resilience Bay", "Clusterville",
           "Endpointburg", "Networkshire"],
    "D4": ["Credentialburg", "Federationville", "SSOford", "Provisiontown",
           "Deprovisionburg", "Entitlementshire", "Directoryville", "Tokenhaven", "Biometricburg"],
}
CITY_MOTIFS = {
    "D1": ["scroll", "magnifier", "scale", "book", "tower", "scroll", "shield", "scroll", "magnifier"],
    "D2": ["book", "gear", "eye", "wall", "tower", "book", "scroll", "gear"],
    "D3": ["flame", "wall", "gear", "shield", "tower", "clock", "cloud", "lock", "shield", "gear", "tower", "cloud"],
    "D4": ["key", "tower", "eye", "gear", "lock", "crown", "book", "key", "eye"],
}
BOSS_NAMES = {
    "D1": ["The Auditor's Keep", "Fortress of Zero Findings", "Castle Non-Compliance"],
    "D2": ["The Architect's Bastion", "Citadel of Assumptions", "Tower of Technical Debt",
           "Fortress Overengineered"],
    "D3": ["The Breach Stronghold", "Fortress Single-Point-of-Failure", "Keep of Configuration Drift",
           "Bastion of Unpatched Systems", "Citadel Downtime"],
    "D4": ["The Privilege Escalation Spire", "Fortress of Orphaned Accounts",
           "Keep of Shared Credentials", "Citadel Standing Access"],
}


def named(names_by_domain, domain_code, idx, fallback_label):
    names = names_by_domain.get(domain_code, [])
    return names[idx - 1] if idx - 1 < len(names) else f"{fallback_label} {idx}"


def even_chunks(items, target_size):
    """Split items into as-even-as-possible chunks near target_size, no short trailing chunk."""
    count = max(1, round(len(items) / target_size))
    base, remainder = divmod(len(items), count)
    chunks = []
    i = 0
    for chunk_idx in range(count):
        size = base + (1 if chunk_idx < remainder else 0)
        chunks.append(items[i:i + size])
        i += size
    return chunks


def build_domain_levels(domain_code, questions):
    ordered = sorted(questions, key=lambda q: (q["exam"], q["examQuestionNumber"]))
    city_pool = [q for q in ordered if q["difficulty"] in ("Easy", "Moderate")]
    boss_pool = [q for q in ordered if q["difficulty"] == "Challenging"]

    prefix = domain_code.lower()
    city_chunks = even_chunks(city_pool, CITY_TARGET_SIZE)
    cities = []
    for idx, chunk in enumerate(city_chunks, start=1):
        cities.append({
            "id": f"{prefix}_c{idx}",
            "index": idx,
            "name": named(CITY_NAMES, domain_code, idx, "City"),
            "motif": named(CITY_MOTIFS, domain_code, idx, "scroll"),
            "questionIds": [q["id"] for q in chunk],
            "questionCount": len(chunk),
            "points": sum(q["points"] for q in chunk),
        })

    boss_chunks = even_chunks(boss_pool, BOSS_PHASE_TARGET_SIZE)
    phases = []
    for idx, chunk in enumerate(boss_chunks, start=1):
        phases.append({
            "id": f"{prefix}_boss_p{idx}",
            "index": idx,
            "name": named(BOSS_NAMES, domain_code, idx, "Boss Phase"),
            "questionIds": [q["id"] for q in chunk],
            "questionCount": len(chunk),
            "points": sum(q["points"] for q in chunk),
        })

    return {
        "domain": domain_code,
        "cities": cities,
        "boss": {"id": f"{prefix}_boss", "phases": phases},
    }


def build(questions_dir: Path, out_dir: Path):
    manifest = json.loads((questions_dir / "manifest.json").read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)

    for entry in manifest:
        questions = json.loads((questions_dir / entry["file"]).read_text(encoding="utf-8"))
        all_ids = {q["id"] for q in questions}

        levels = build_domain_levels(entry["domain"], questions)

        assigned_ids = set()
        for city in levels["cities"]:
            assigned_ids.update(city["questionIds"])
        for phase in levels["boss"]["phases"]:
            assigned_ids.update(phase["questionIds"])

        if assigned_ids != all_ids:
            missing = all_ids - assigned_ids
            extra = assigned_ids - all_ids
            raise RuntimeError(f"{entry['domain']}: level assignment mismatch, missing={missing} extra={extra}")

        out_path = out_dir / entry["file"]
        out_path.write_text(json.dumps(levels, indent=2, ensure_ascii=False), encoding="utf-8")
        print(
            f"{entry['domain']}: {len(levels['cities'])} cities "
            f"(sizes {[c['questionCount'] for c in levels['cities']]}), "
            f"{len(levels['boss']['phases'])} boss phases "
            f"(sizes {[p['questionCount'] for p in levels['boss']['phases']]})"
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions-dir", default=str(ROOT / "data" / "questions"))
    parser.add_argument("--out-dir", default=str(ROOT / "data" / "levels"))
    args = parser.parse_args()
    build(Path(args.questions_dir), Path(args.out_dir))


if __name__ == "__main__":
    main()
