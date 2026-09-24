"""Render the GitHub wiki's Lore page from data/lore.json.

The wiki is a separate repository, so it is the one place game prose can quietly
drift out of date. Generating the page instead of hand-writing it means the only
copy anyone edits is data/lore.json.

Run after editing the lore (nothing else in the pipeline depends on it):
    python3 pipeline/build_wiki.py

Then publish wiki/Lore.md to the wiki repo -- see the note at the foot of the
generated page.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# The wizard roster is assembled from three places, exactly as the in-game Lore
# screen assembles it: bios and titles from lore.json, name/principle/order from
# pixelArt.js, school from lore.js. Those tables are parsed rather than copied,
# because a fourth hand-maintained copy is a fourth thing to forget to update.
PIXEL_ART_JS = ROOT / "web" / "js" / "pixelArt.js"
LORE_JS = ROOT / "web" / "js" / "screens" / "lore.js"

WIZARD_ENTRY_RE = re.compile(
    r"^\s*(\w+):\s*\{\s*name:\s*\"([^\"]+)\",\s*principle:\s*\"([^\"]+)\"", re.M
)
WIZARD_ORDER_RE = re.compile(r"export const WIZARD_ORDER\s*=\s*\[(.*?)\];", re.S)
SCHOOLS_RE = re.compile(r"const SCHOOLS\s*=\s*\{(.*?)\};", re.S)
SCHOOL_ENTRY_RE = re.compile(r"(\w+):\s*\"([^\"]+)\"")


def parse_wizard_tables():
    """(order, {key: (name, principle)}, {key: school}) from the two JS modules."""
    pixel_art = PIXEL_ART_JS.read_text(encoding="utf-8")
    lore_js = LORE_JS.read_text(encoding="utf-8")

    names = {m.group(1): (m.group(2), m.group(3)) for m in WIZARD_ENTRY_RE.finditer(pixel_art)}

    order_match = WIZARD_ORDER_RE.search(pixel_art)
    if not order_match:
        raise RuntimeError(f"WIZARD_ORDER not found in {PIXEL_ART_JS}")
    order = re.findall(r"\"(\w+)\"", order_match.group(1))

    schools_match = SCHOOLS_RE.search(lore_js)
    if not schools_match:
        raise RuntimeError(f"SCHOOLS not found in {LORE_JS}")
    schools = dict(SCHOOL_ENTRY_RE.findall(schools_match.group(1)))

    if not (len(order) == len(names) == len(schools) == 8):
        raise RuntimeError(
            "expected 8 wizards from each source, got "
            f"order={len(order)} names={len(names)} schools={len(schools)} -- "
            "the JS tables have moved and the regexes above need updating"
        )
    missing = [k for k in order if k not in names or k not in schools]
    if missing:
        raise RuntimeError(f"wizards in WIZARD_ORDER with no name/school entry: {missing}")
    return order, names, schools


def clean(text):
    """lore.json keeps trailing spaces; two of them are a <br> in Markdown."""
    return re.sub(r"[ \t]+$", "", (text or "").strip(), flags=re.M)


def unquote(counsel):
    """Counsel is stored already wrapped in quotes; the blockquote supplies its own."""
    return clean(counsel).strip("\"“”")


def render(lore, order, names, schools):
    out = []
    w = out.append

    w(f"# {clean(lore['title'])}")
    w("")
    w(f"*{clean(lore['subtitle'])}*")
    w("")
    w("This is the backstory for **ISSAP Cyber Redemption**, a gamified practice test for the "
      "ISSAP exam. Everything below is in-world, but the mechanics it describes are real ones "
      "you meet in the game. The same text is readable in-game from the title screen under "
      "**Lore**.")
    w("")
    w("---")
    w("")

    w("## The World")
    w("")
    for paragraph in lore["world"]:
        w(clean(paragraph))
        w("")

    w("---")
    w("")
    w("## The Journey")
    w("")
    w("Six beats, mapped onto the shape of the game itself.")
    w("")
    for i, beat in enumerate(lore["journey"], start=1):
        w(f"### {i}. {clean(beat['step'])}")
        w("")
        w(clean(beat["text"]))
        w("")

    w("---")
    w("")
    w("## The Four Colossi")
    w("")
    w(clean(lore["adversariesIntro"]))
    w("")
    w("| Colossus | Epithet | Nation it holds | Domain |")
    w("| --- | --- | --- | --- |")
    for a in lore["adversaries"]:
        w(f"| **{a['name']}** | *{clean(a['epithet'])}* | {clean(a['nation'])} | {a['domain']} |")
    w("")
    for a in lore["adversaries"]:
        w(f"### {a['name']} — {clean(a['epithet'])}")
        w("")
        w(f"**Holds:** {clean(a['nation'])} ({a['domain']})")
        w("")
        w(clean(a["text"]))
        w("")

    w("---")
    w("")
    w("## The Eight Wizards")
    w("")
    w(clean(lore["wizardsIntro"]))
    w("")
    w("Each wizard is one of the eight classic secure design principles, themed on one of the "
      "eight schools of magic. A wizard is assigned per city and stays with you for every "
      "question in it, explaining every answer — including the ones you get right.")
    w("")
    w("| Wizard | Title | Principle | School |")
    w("| --- | --- | --- | --- |")
    for key in order:
        name, principle = names[key]
        w(f"| **{name}** | {clean(lore['wizards'][key]['title'])} | {principle} | {schools[key]} |")
    w("")
    for key in order:
        name, principle = names[key]
        entry = lore["wizards"][key]
        w(f"### {name}")
        w("")
        w(f"**{clean(entry['title'])}** · {principle} · {schools[key]}")
        w("")
        w(clean(entry["bio"]))
        w("")
        w(f"> {unquote(entry['counsel'])}")
        w("")

    w("---")
    w("")
    w("## The Return")
    w("")
    w(clean(lore["closing"]))
    w("")
    w("---")
    w("")
    w("<sub>This page is generated by `pipeline/build_wiki.py` from `data/lore.json` in the main "
      "repository, which is the source of truth for all in-game prose. Edit the lore there and "
      "re-run the script rather than editing this page, or the wiki and the game will disagree."
      "</sub>")
    w("")
    return "\n".join(out)


def build(lore_path, out_path):
    lore = json.loads(lore_path.read_text(encoding="utf-8"))
    order, names, schools = parse_wizard_tables()

    missing = [k for k in order if k not in lore["wizards"]]
    if missing:
        raise RuntimeError(f"lore.json has no entry for wizards: {missing}")

    page = render(lore, order, names, schools)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # newline="\n": the wiki is read on github.com and cloned on every platform,
    # and this repo is developed on Windows with core.autocrlf=true.
    with out_path.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(page)

    print(
        f"{out_path.relative_to(ROOT)}: {len(page.splitlines())} lines, "
        f"{len(lore['journey'])} journey beats, {len(lore['adversaries'])} colossi, "
        f"{len(order)} wizards"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lore", default=str(ROOT / "data" / "lore.json"))
    parser.add_argument("--out", default=str(ROOT / "wiki" / "Lore.md"))
    args = parser.parse_args()
    build(Path(args.lore), Path(args.out))


if __name__ == "__main__":
    main()
