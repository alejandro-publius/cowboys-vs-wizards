"""Render the three self-contained pixel maps from the recorded Showdown workflows.

Run `python3 scripts/render-frontier-dispatch.py` to regenerate the checked-in
maps, or add `--check` for a byte-for-byte check. Scene authoring uses Pillow.
"""

import argparse
import json
from pathlib import Path
from xml.sax.saxutils import escape

from frontier_dispatch.compact import draw_compact
from frontier_dispatch.graphics import (BG, BOARD, CREAM, EDGE, FAIL, GOLD, MINT, MUTED,
                                       PURPLE, MOTION, arena_view, ico, lamp, panel, rect, wire)
from frontier_dispatch.lettering import bit, bitmap_defs
from frontier_dispatch.props import pixel_marks
from frontier_dispatch.scene import pixel_scene

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs/media"
EVIDENCE = ROOT / "docs/evidence"


def receipt(name):
    return json.loads((EVIDENCE / name).read_text())


def read_results():
    arena = receipt("saloon-agent-arena/showcase.json")
    forge = receipt("player-card-forge/showcase.json")
    audit = receipt("billy-seat-audit/result.json")
    crew = receipt("night-shift/crew-scheduled-2026-11-20.json")
    power = receipt("showdown-installed-power/boot-hill-receipt.json")
    cases = receipt("outrider-gate/receipt.json")["cases"]
    # The published independent referee audit is a Markdown table.
    table = (EVIDENCE / "claude-referee-legal-branches.md").read_text().splitlines()
    frozen_row = next(line for line in table if line.startswith("| frozen,"))
    cells = [col.strip() for col in frozen_row.strip("|").split("|")]
    matched, played = cells[1].split("/")
    if matched != played:
        raise ValueError("Update the rules audit caption for the new result")
    by_seat = audit["byFirst"].values()
    per_arm = sum(seat["gamesPerArm"] for seat in by_seat)
    def cowboy_share(arm):
        wins = sum(seat[arm]["cowboy"] for seat in by_seat)
        return f"{wins / per_arm:.3%}"
    return {
        "rules_positions": matched,
        "open_hellfire": int(cells[4]),
        "series": arena["summary"]["games"],
        "deals": arena["series"]["deals"],
        "sheriff": arena["summary"]["wins"]["cautious-sheriff"],
        "wizard": arena["summary"]["wins"]["reckless-wizard"],
        "decisions": arena["replay"]["decisions"],
        "replay_seed": arena["replay"]["seed"],
        "card": forge["draft"]["name"],
        "summoned": forge["candidateGames"]["gamesWithSlotSummoned"],
        "candidate": forge["candidateGames"]["games"],
        "baseline": cowboy_share("baseline"),
        "proposal": cowboy_share("candidate"),
        "duels": f"{audit['totalDuels']:,}",
        "power": len(power["proof"]["actions"]),
        "crew_games": f"{crew['nightWatch']['receipt']['samples']['candidate']['games']:,}",
        "cases": len(cases),
    }


def score_panel(m):
    x, y, w = 367, 40, 140
    a = [
        panel(x, y, w, 201, "#102526", EDGE),
        rect(x+3, y+3, w-6, 20, "#243e39"),
        rect(x+4, y+4, 2, 17, GOLD),
        bit(x+11, y+16, "AGENT ARENA", 9, CREAM),
        bit(x+8, y+36, "RECORDED WINS", 7, MUTED),
    ]
    for row, (name, wins, color) in enumerate([
        ("SHERIFF", m["sheriff"], GOLD), ("WIZARD", m["wizard"], PURPLE)
    ]):
        top = y+42 + 26*row
        a += [rect(x+6, top, w-12, 23, "#1c3436"), rect(x+6, top, 3, 23, color),
              bit(x+14, top+15, name, 8, CREAM), bit(x+w-13, top+18, str(wins), 14, color, "end")]
    a += [bit(x+8, y+107, f"{m['series']} DUELS", 7, CREAM),
          bit(x+w-8, y+107, f"{m['deals']} DEALS", 7, MUTED, "end")]
    for i in range(m["series"]):
        a.append(rect(x+8+i*7.8, y+113, 6.6, 5, GOLD if i < m["sheriff"] else PURPLE))
    a += [rect(x+6, y+127, w-12, 1, EDGE),
          ico("prop-referee", x+7, y+133, 18), bit(x+30, y+146, "REPLAY", 8, MINT),
          bit(x+8, y+164, f"SEED {m['replay_seed']}", 7, MUTED),
          bit(x+8, y+183, f"{m['decisions']}/{m['decisions']}", 14, CREAM),
          bit(x+8, y+195, "CHOICES VERIFIED", 7, MINT),
          lamp(x+w-17, y+174, 6, MINT, 6)]
    return "".join(a)


def playbook_circuit():
    # Both policy files originate with an agent; the referee runs the engine.
    a = [rect(5, 245, 502, 37, "#192d32"),
         rect(5, 245, 502, 1, EDGE), rect(5, 281, 502, 1, EDGE),
         bit(11, 259, "SHERIFF PLAYBOOK", 7, GOLD),
         bit(11, 275, "WIZARD PLAYBOOK", 7, PURPLE),
         wire([(105,255),(120,255),(129,264),(155,264)], GOLD, 0),
         wire([(105,271),(120,271),(127,264),(155,264)], PURPLE, 2),
         lamp(155,262,4,MINT,4),
         bit(167, 259, "ARENA REFEREE", 8, CREAM),
         bit(167, 273, "PLAYS BOTH SEATS", 7, MUTED),
         wire([(267,264),(304,264)], MINT, 4.5), lamp(304,262,4,MINT,6),
         bit(317, 259, "VERIFY THE REPLAY", 8, CREAM),
         bit(317, 273, "CHECK EACH RECORDED CHOICE", 7, MUTED)]
    return "".join(a)


def other_reviews(m):
    a = []
    for y, symbol, accent, heading, author, reviewer, result, proof, delay in [
        (288, "forge", GOLD, "CARD FORGE", "CARD AUTHOR", "FORGE REVIEWER", m["card"],
         f"SUMMONED IN {m['summoned']}/{m['candidate']} GAMES", 4),
        (316, "balance", PURPLE, "BALANCE", "BALANCER", "BALANCE REVIEWER", "BILLY ATTACK 2 → 1",
         "ALEX AND FABLE DECIDE", 6),
    ]:
        a += [ico("prop-"+symbol, 5, y, 23), bit(32, y+15, heading, 8, accent),
              bit(113, y+14, author, 7, CREAM),
              wire([(187,y+10),(206,y+10)],accent,delay),
              bit(216, y+14, reviewer, 7, CREAM),
              wire([(311,y+10),(333,y+10)],accent,delay+1),
              bit(345, y+9, result, 8, accent), bit(345, y+22, proof, 7, MUTED),
              rect(5,y+25,502,1,"#33464a")]
    a += [rect(5,344,502,20,"#223338"), bit(12,357,"LATER BILLY AUDIT",7,MUTED),
          bit(131,358,f"{m['baseline']} → {m['proposal']}",9,GOLD),
          bit(307,357,f"COWBOY WINS / {m['duels']} DUELS",7,CREAM)]
    return "".join(a)


def release_and_checks(m):
    a = [ico("prop-gate",5,372,24), bit(34,382,"RELEASE",8,CREAM), bit(34,395,"REVIEW",7,MUTED),
         bit(106,389,"CHECK COMMIT",7,CREAM),
         wire([(180,385),(195,385),(203,377),(218,377)],MINT,9),
         wire([(180,385),(195,385),(203,395),(218,395)],FAIL,11),
         bit(228,381,"MATCH",7,MINT), bit(294,381,"RUN NODE + CHROME",7,CREAM),
         bit(228,399,"MISMATCH",7,FAIL),bit(294,399,"STOP BEFORE TESTS",7,CREAM),
         rect(0,408,512,35,"#233632"),rect(0,408,512,1,"#607467")]
    for x, sprite, label, value in [
        (5,"hook","SAVE HOOK",f"{m['cases']} STALE"),
        (121,"power","DUEL POWER",f"{m['power']} ACTIONS"),
        (245,"crew","NIGHT WATCH",f"{m['crew_games']}/REV"),
        (376,"referee","PYTHON AUDIT",m["rules_positions"]+" MATCHED"),
    ]:
        a += [ico("prop-"+sprite,x,413,19),bit(x+23,421,label,7,CREAM),bit(x+23,435,value,7,MUTED)]
    return "".join(a)


def draw_wide(m):
    a = [rect(0, 0, 512, 443, BG),
         rect(0,0,512,2,"#5a7561"), rect(7,9,2,24,GOLD),
         bit(14,14,"COWBOYS VS. WIZARDS",7,GOLD),
         bit(14,33,"KIRO'S NIGHT SHIFT",14,CREAM),
         bit(503,23,"KIRO WORKFLOW MAP",8,MUTED,"end"),
         panel(4,39,361,203,"#101c20",EDGE), arena_view(5,40,359),
         score_panel(m), playbook_circuit(), other_reviews(m), release_and_checks(m)]
    return 512, 443, "".join(a)


def render(layout, m, defs):
    width, height, contents = layout
    if isinstance(contents, list):
        contents = "".join(contents)
    description = (
        f"An original isometric frontier arena. Kiro's Cautious Sheriff and Reckless Wizard each write "
        f"a playbook. The referee plays {m['deals']} deals from both starting seats. The Sheriff wins "
        f"{m['sheriff']} games and the Wizard wins {m['wizard']}. All {m['decisions']} choices in the seed "
        f"{m['replay_seed']} replay are verified. In separate workflows a reviewer tests Dusty Pete, and "
        f"Billy's proposed attack change goes to Alex and Fable. Cowboy wins in a later {m['duels']}-duel "
        f"bot audit move from {m['baseline']} to {m['proposal']}. The release reviewer runs Node and Chrome "
        f"on a matching commit and refuses a different commit before testing. The guide linked in the README "
        "gives commands and evidence for the Outrider hook, installed Duel Review Power, Night Watch Crew "
        "and independent Python rules audit."
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width*2}" height="{height*2}"
  viewBox="0 0 {width} {height}" shape-rendering="crispEdges" role="img" aria-labelledby="title desc">
<title id="title">Kiro’s Night Shift — Cowboys vs. Wizards</title>
<desc id="desc">{escape(description)}</desc>
<!-- Generated by scripts/render-frontier-dispatch.py from the game's recorded workflows. -->
<defs><style>{MOTION}</style>{defs}</defs>
<g id="still">{contents}</g>
</svg>
'''


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare published maps without writing")
    args = parser.parse_args()
    data = read_results()
    definitions = bitmap_defs() + pixel_marks() + pixel_scene()
    for filename, layout in [
        ("frontier-workflow-map.svg", draw_wide(data)),
        ("frontier-night-shift.svg", draw_compact(data, False)),
        ("frontier-night-shift-mobile.svg", draw_compact(data, True)),
    ]:
        target = MEDIA / filename
        svg = render(layout, data, definitions)
        if args.check:
            if not target.is_file() or target.read_text() != svg:
                raise SystemExit(f"Regenerate {target.name}")
        else:
            target.write_text(svg)
