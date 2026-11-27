"""Render all README workflow maps. Run with Python 3 and Pillow."""

import argparse
import json
from itertools import groupby
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "docs/media"
EVIDENCE = ROOT / "docs/evidence"
INK = "#222827"
PALE = "#fff0d3"
GOLD = "#f7b75e"
VIOLET = "#c4a2f3"
SAGE = "#acd9c1"
QUIET = "#c5c6bc"


def receipt(name):
    return json.loads((EVIDENCE / name).read_text())


def read_results():
    arena = receipt("saloon-agent-arena/showcase.json")
    forge = receipt("player-card-forge/showcase.json")
    audit = receipt("billy-seat-audit/result.json")
    crew = receipt("night-shift/crew-scheduled-2026-11-20.json")
    power = receipt("showdown-installed-power/boot-hill-receipt.json")
    cases = receipt("outrider-gate/receipt.json")["cases"]
    by_seat = audit["byFirst"].values()
    per_arm = sum(seat["gamesPerArm"] for seat in by_seat)
    def cowboy_share(arm):
        wins = sum(seat[arm]["cowboy"] for seat in by_seat)
        return f"{wins / per_arm:.3%}"
    return {
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


def painted_plate(name, source, size, position, colors):
    """Convert approved pixel paintings into self-contained SVG scanlines.

    GitHub can serve the figure directly under a restrictive content policy.
    Native paths also keep the art visible in downloadable and offline copies.
    """
    with Image.open(ROOT / source) as original:
        art = ImageOps.fit(original.convert("RGB"), size, centering=position)
        indexed = art.quantize(colors=colors, dither=Image.Dither.NONE)
    palette = indexed.getpalette()
    paths = {}
    for y in range(size[1]):
        x = 0
        for index, run in groupby(indexed.crop((0, y, size[0], y + 1)).getdata()):
            length = sum(1 for _ in run)
            paths.setdefault(index, []).append(f"M{x} {y}h{length}v1H{x}Z")
            x += length
    lines = []
    for index, runs in paths.items():
        color = bytes(palette[index * 3:index * 3 + 3]).hex()
        lines.append(f'<path fill="#{color}" d="{"".join(runs)}"/>')
    return (f'<!-- {source} -->\n<symbol id="{name}" viewBox="0 0 {size[0]} {size[1]}" '
            'preserveAspectRatio="none" shape-rendering="crispEdges">\n'
            + "\n".join(lines) + "\n</symbol>")


def artwork():
    return "\n".join([
        painted_plate("town", "assets/scenes/showdown-storybook.webp", (184, 72), (.56, .56), 68),
        painted_plate("sheriff", "assets/cards/illustrated/cowboy-sheriff.webp", (62, 76), (.48, .21), 54),
        painted_plate("wizard", "assets/cards/illustrated/wizard-wizard.webp", (62, 76), (.52, .19), 54),
    ])


def t(x, y, s, size, color=INK, face="body", anchor="start"):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="{face}" '
            f'font-size="{size}" fill="{color}">{escape(str(s))}</text>')


def rect(x, y, w, h, fill, stroke="none"):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}"/>'


def path(d, fill="none", stroke="none", sw=1):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def use(name, x, y, w, h):
    return f'<use href="#{name}" xlink:href="#{name}" x="{x}" y="{y}" width="{w}" height="{h}"/>'


def outline(x, y, w, h, notch):
    return (f"M{x+notch} {y}H{x+w-notch}l{notch} {notch}v{h-2*notch}l-{notch} {notch}"
            f"H{x+notch}l-{notch} -{notch}V{y+notch}Z")


def plate(x, y, w, h, fill, border, notch=7):
    return path(outline(x, y, w, h, notch), fill, border)


def illuminate(x, y, w, h, color, delay, notch=7):
    return (f'<path class="receive" style="--wait:{delay}s" d="{outline(x,y,w,h,notch)}" '
            f'fill="none" stroke="{color}" stroke-width="3.5"/>')


def signal(d, color, delay):
    """Static rail and direction stay visible. A small dispatch runs over the rail."""
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-opacity=".68" stroke-width="2"/>'
            f'<path class="signal" style="--wait:{delay}s" d="{d}" pathLength="100" fill="none" '
            f'stroke="{color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="16 113"/>')


def pin(x, y, color):
    return f'<circle cx="{x}" cy="{y}" r="4.5" fill="{color}" stroke="#28292d" stroke-width="2"/>'


def dispatch_stamp(x, y, name, accent):
    """Small vector marks refer to the job shown next to them."""
    marks = {
        "hook": '<path d="M8 3v12a6 6 0 0 0 12 0v-4l-4 4M5 4h6"/>',
        "power": '<path d="M3 7h14v16H3zM8 3h14v16M7 14h6m-3-3v6"/>',
        "crew": '<circle cx="13" cy="13" r="9"/><path d="M13 7v6l5 3M10 1h6"/>',
        "referee": '<path d="M12 2v19M5 22h15M3 6l19-3M5 7l-4 8h9zM21 5l-4 8h8z"/>',
    }
    return (f'<g transform="translate({x} {y})" fill="none" stroke="{accent}" stroke-width="1.8" '
            f'stroke-linecap="round" stroke-linejoin="round">{marks[name]}</g>')


CSS = """
text { font-family: Arial, Helvetica, sans-serif }
.display { font-family: Georgia, 'Times New Roman', serif; font-weight: 700 }
.italic { font-family: Georgia, 'Times New Roman', serif; font-style: italic }
.head { font-weight: 700 }
.label { font-weight: 700; letter-spacing: 1.4px }
.code { font-family: Menlo, Consolas, monospace }
.signal, .receive { opacity: 0; pointer-events: none }
@media (prefers-reduced-motion: no-preference) {
  .signal { animation: dispatch 16s linear infinite; animation-delay: var(--wait) }
  .receive { animation: receive 16s ease-in-out infinite; animation-delay: var(--wait) }
}
#still:target .signal, #still:target .receive { animation: none; opacity: 0 }
@keyframes dispatch {
  0% { opacity: 0; stroke-dashoffset: 17 }
  2% { opacity: .95; stroke-dashoffset: 14 }
  17% { opacity: .95; stroke-dashoffset: -94 }
  20%, 100% { opacity: 0; stroke-dashoffset: -114 }
}
@keyframes receive {
  0%, 21%, 100% { opacity: 0 }
  5%, 12% { opacity: .95 }
}
"""


def frame(width, height, content, art, description):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">Inside the Night Shift — Kiro workflows in Cowboys vs. Wizards</title>
  <desc id="desc">{escape(description)}</desc>
  <!-- Rebuild with scripts/render-frontier-dispatch.py. Art and figures come from the game repository. -->
  <defs>
    <style>{CSS}</style>
    <linearGradient id="header-ink"><stop offset="0" stop-color="#161c20"/><stop offset=".66" stop-color="#161c20" stop-opacity=".95"/><stop offset="1" stop-color="#161c20" stop-opacity="0"/></linearGradient>
    <linearGradient id="sky-shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#181721" stop-opacity=".10"/><stop offset=".55" stop-color="#181721" stop-opacity=".02"/><stop offset="1" stop-color="#101719" stop-opacity=".85"/></linearGradient>
    <pattern id="paper" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M1 2h1M6 6h1" stroke="#5b4426" stroke-width=".7" opacity=".13"/></pattern>
    {art}
  </defs>
  <rect width="{width}" height="{height}" fill="#1b2325"/>
  <g id="still">{''.join(content)}</g>
</svg>\n"""


def header(w, mobile):
    if mobile:
        return [use("town", 0, 0, w, 137), rect(0, 0, w, 137, "url(#sky-shade)"),
                rect(0, 0, 338, 137, "url(#header-ink)"),
                t(18, 32, "COWBOYS VS. WIZARDS", 13, GOLD, "label"),
                t(17, 72, "Inside the Night Shift", 28.5, PALE, "display"),
                t(18, 103, "Recorded Kiro workflows", 18, PALE),
                path(f"M0 137h{w}m-{w} 4h{w}", stroke="#b59768")]
    return [use("town", 404, 0, 496, 153), rect(403, 0, 497, 153, "url(#sky-shade)"),
            rect(0, 0, 408, 153, "#161c20"), rect(397, 0, 171, 153, "url(#header-ink)"),
            path("M33 34h33m-3-3 4 3-4 3", stroke=GOLD, sw=1.5),
            t(77, 39, "COWBOYS VS. WIZARDS", 14, GOLD, "label"),
            t(32, 95, "Inside the Night Shift", 45, PALE, "display"),
            t(34, 128, "Recorded Kiro workflows behind Showdown", 19, PALE),
            path("M0 153h900M0 157h900", stroke="#ad9269")]


def arena(m, mobile):
    if mobile:
        a = [t(18, 179, "Saloon Agent Arena", 27, PALE, "display"),
             t(18, 207, "Two agents each write one playbook.", 17.5, QUIET)]
        for x, name, line1, line2, policy, color, bg in [
            (15, "sheriff", "Cautious", "Sheriff", "Traps first", GOLD, "#342a23"),
            (185, "wizard", "Reckless", "Wizard", "Spells first", VIOLET, "#302b3a")]:
            a += [plate(x, 224, 160, 92, bg, color, 5), use(name, x+4, 229, 59, 82),
                  t(x+70, 251, line1, 18, PALE, "display"), t(x+70, 273, line2, 18, PALE, "display"),
                  t(x+70, 297, policy, 13.5, color, "head"),
                  illuminate(x, 224, 160, 92, color, 0 if name == "sheriff" else 1.7, 5)]
        a += [signal("M96 317v13q0 6 6 6h55q5 0 5 5v7", GOLD, 0),
              signal("M265 317v13q0 6-6 6h-55q-5 0-5 5v7", VIOLET, 1.7),
              path("m158 346 4 6 4-6", GOLD), path("m195 346 4 6 4-6", VIOLET),
              plate(36, 353, 288, 68, "#2d3534", "#8c8e78"),
              dispatch_stamp(51, 371, "referee", GOLD), t(90, 381, "Arena referee", 23, PALE, "display"),
              t(90, 406, "Runs both starting seats.", 16.5, QUIET),
              illuminate(36, 353, 288, 68, SAGE, 3.8),
              signal("M180 422v16", SAGE, 3.2), path("m176 434 4 6 4-6", SAGE),
              t(180, 463, f"{m['series']} duels played", 20, PALE, "head", "middle"),
              t(35, 491, f"{m['sheriff']} Sheriff wins", 16.5, GOLD, "head"),
              t(325, 491, f"{m['wizard']} Wizard wins", 16.5, VIOLET, "head", "end")]
        a += score_bar(34, 500, 292, m) + [
            t(180, 535, f"Seed {m['replay_seed']} replay verified all {m['decisions']} choices.", 16, QUIET, anchor="middle")]
        return a
    a = [t(34, 201, "Saloon Agent Arena", 32, PALE, "display"),
         t(865, 194, "KIRO CLI / saloon-agent-arena", 14.5, GOLD, "code", "end"),
         t(35, 230, "Two agents each write one playbook. The referee runs them on the Showdown engine.", 18, QUIET)]
    for x, name, first, last, policy, color, bg in [
        (32, "sheriff", "Cautious", "Sheriff", "Prioritizes traps", GOLD, "#342c25"),
        (620, "wizard", "Reckless", "Wizard", "Prioritizes spells", VIOLET, "#302b39")]:
        a += [plate(x, 250, 248, 104, bg, color), use(name, x+8, 257, 79, 90),
              t(x+100, 280, first, 23, PALE, "display"), t(x+100, 307, last, 25, PALE, "display"),
              t(x+100, 334, policy, 15.5, color, "head"),
              illuminate(x, 250, 248, 104, color, 0 if name == "sheriff" else 1.7)]
    a += [signal("M281 300h55", GOLD, 0), signal("M619 300h-55", VIOLET, 1.7),
          path("m329 295 9 5-9 5z", GOLD), path("m571 295-9 5 9 5z", VIOLET),
          plate(340, 251, 220, 102, "#2c3433", "#99967c"),
          dispatch_stamp(354, 264, "referee", GOLD), t(389, 285, "Arena referee", 22, PALE, "display"),
          t(450, 314, "Runs both playbooks", 16.5, QUIET, anchor="middle"),
          t(450, 336, "from both starting seats.", 16.5, QUIET, anchor="middle"),
          illuminate(340, 251, 220, 102, SAGE, 3.8),
          signal("M450 354v24", SAGE, 3.2), path("m445 372 5 8 5-8z", SAGE),
          path("M32 380h836M32 442h836", stroke="#66716b"),
          t(47, 409, f"{m['series']} duels", 24, PALE, "display"),
          t(48, 431, f"{m['deals']} deals, both seats", 15, QUIET),
          t(246, 405, f"{m['sheriff']} Sheriff wins", 16, GOLD, "head"),
          t(581, 405, f"{m['wizard']} Wizard wins", 16, VIOLET, "head", "end"),
          path("M612 392v37", stroke="#697067"), t(632, 404, f"Seed {m['replay_seed']} replay", 15.5, QUIET),
          t(632, 429, f"{m['decisions']} choices verified", 19, PALE, "head")]
    a += score_bar(246, 415, 335, m)
    return a


def score_bar(x, y, width, m):
    step = width / m["series"]
    return [rect(round(x+i*step, 2), y, round(step-2.5, 2), 7,
                 GOLD if i < m["sheriff"] else VIOLET) for i in range(m["series"])]


def workflow(x, y, w, mode, m):
    forge = mode == "forge"
    paper, line, accent = ("#f4e5c6", "#b8a07a", "#805018") if forge else ("#e9dfed", "#ad9ab4", "#644981")
    title = "Card Forge" if forge else "Balance review"
    slug = "player-card-forge" if forge else "night-shift-review"
    steps = ([("Card author", "Drafts one card in a sandbox."),
              ("Forge reviewer", "Tests both decks on the same deals.")]
             if forge else [("Balancer", "Proposes one change to a troop."),
                            ("Separate reviewer", "Passes the edit or sends it back.")])
    a = [plate(x, y, w, 255, paper, line), rect(x+7, y+6, w-14, 242, "url(#paper)"),
         t(x+20, y+32, title, 27, INK, "display"), t(x+21, y+56, slug, 14.5, accent, "code"),
         path(f"M{x+18} {y+69}h{w-36}", stroke=line),
         signal(f"M{x+24} {y+90}v96", accent, 4.6 if forge else 7.0)]
    for i, (role, detail) in enumerate(steps):
        top = y+96+55*i
        a += [pin(x+24, top-5, paper), t(x+40, top, role, 19.5, INK, "head"),
              t(x+40, top+22, detail, 16, INK)]
    a += [path(f"m{x+20} {y+183} 4 6 4-6", accent), path(f"M{x+18} {y+192}h{w-36}", stroke=line),
          illuminate(x, y, w, 255, accent, 5.2 if forge else 7.6)]
    if forge:
        a += [t(x+21, y+218, m["card"], 20.5, accent, "display"),
              t(x+21, y+242, f"Summoned in {m['summoned']} of {m['candidate']} candidate games.", 16, INK)]
    else:
        a += [t(x+21, y+218, "Billy’s attack, 2 to 1", 20.5, accent, "display"),
              t(x+21, y+242, "Passed review. Alex and Fable decide.", 16, INK)]
    return a


def other_checks(m, mobile):
    notes = [
        ("hook", GOLD, "On a rules save", "Outrider hook",
         [f"A rule edit marked all {m['cases']}", "replays stale. Restoring it", "cleared every case."],
         [f"A rule edit marked all {m['cases']} replays stale.", "Restoring it made them pass again."]),
        ("power", VIOLET, "From the Cowboy seat", "Orb Duel Review Power",
         [f"Kiro played {m['power']} legal actions.", "A changed engine made the", "same replay go stale."],
         [f"Kiro played {m['power']} legal actions. The replay", "went stale on a changed engine."]),
        ("crew", SAGE, "At 2 a.m. Pacific", "Night Watch Crew",
         ["The scheduled run compared", f"{m['crew_games']} games per revision.", "Both win counts matched."],
         [f"Crew compared {m['crew_games']} games per revision.", "Both win counts matched."]),
    ]
    if mobile:
        a = [t(18, 1265, "Checks outside the arena", 24, PALE, "display")]
        for i, (mark, color, when, name, _, lines) in enumerate(notes):
            y = 1295 + 116*i
            a += [path(f"M18 {y-9}h324", stroke="#636b66"), dispatch_stamp(18, y+2, mark, color),
                  t(55, y+12, when, 14, color, "head"), t(55, y+34, name, 20, PALE, "display"),
                  t(18, y+63, lines[0], 16, QUIET), t(18, y+85, lines[1], 16, QUIET)]
        return a
    a = [t(34, 866, "Checks outside the arena", 26, PALE, "display")]
    for i, (mark, color, when, name, lines, _) in enumerate(notes):
        x = [34, 319, 605][i]
        a += [dispatch_stamp(x, 885, mark, color), t(x+32, 902, when, 14.5, color, "head"),
              t(x, 937, name, 20, PALE, "display")]
        a += [t(x, 963+22*j, line, 16.5, QUIET) for j, line in enumerate(lines)]
        if i < 2:
            a.append(path(f"M{x+265} 887v120", stroke="#59645f"))
    return a


def release_switch(mobile):
    """The pass and refusal are separate, recorded invocations of the same reviewer."""
    green, red = "#addec4", "#efab91"
    if mobile:
        return [
            rect(0, 1634, 360, 224, "#29312e"), t(18, 1666, "Release review", 25, PALE, "display"),
            t(18, 1692, "The reviewer checks the commit ID.", 17, QUIET),
            signal("M24 1709v22q0 5 6 5h25", green, 10),
            signal("M24 1709v90q0 5 6 5h25", red, 12), pin(24, 1709, PALE),
            path("m52 1732 7 4-7 4z", green), path("m52 1800 7 4-7 4z", red),
            t(67, 1742, "Match", 18, green, "head"),
            t(67, 1764, "Runs Node and Chrome checks,", 16, PALE),
            t(67, 1785, "then verifies the receipt.", 16, PALE),
            t(67, 1810, "Mismatch", 18, red, "head"),
            t(67, 1833, "Stops before testing the game.", 16, PALE)]
    return [
        rect(0, 1031, 900, 151, "#29312e"), path("M34 1032h832", stroke="#778176"),
        t(33, 1071, "Release review", 26, PALE, "display"),
        t(864, 1068, "independent-release-review", 14.5, SAGE, "code", "end"),
        plate(34, 1090, 227, 66, "#28302e", "#8b998a"),
        t(51, 1116, "Requested commit", 18.5, PALE, "head"),
        t(51, 1141, "Reviewed against HEAD", 16, QUIET),
        signal("M261 1123h36q8 0 14-7l6-8q4-5 12-5h22", green, 10),
        signal("M261 1123h36q8 0 14 7l6 8q4 5 12 5h22", red, 12),
        path("m348 1098 8 5-8 5z", green), path("m348 1138 8 5-8 5z", red),
        t(372, 1109, "Match", 18, green, "head"), t(481, 1109, "Run Node and Chrome, then verify the receipt.", 16.5, PALE),
        t(372, 1149, "Mismatch", 18, red, "head"), t(481, 1149, "Stop before any game checks run.", 16.5, PALE)]


def draw(m, art, mobile):
    w, h = (360, 1969) if mobile else (900, 1258)
    a = header(w, mobile) + arena(m, mobile)
    if mobile:
        a += [t(18, 579, "OTHER KIRO CLI WORKFLOWS", 13, GOLD, "label")]
        a += workflow(15, 596, 330, "forge", m) + workflow(15, 864, 330, "balance", m)
        a += [t(18, 1151, "Later Billy audit", 20, PALE, "head"),
              t(17, 1185, f"{m['baseline']} → {m['proposal']}", 28, GOLD, "display"),
              t(18, 1213, f"Cowboy wins across {m['duels']} bot duels.", 16, QUIET),
              path("M18 1233h324", stroke="#666f66")]
        a += other_checks(m, True) + release_switch(True)
        a += [rect(0, 1858, w, 111, "#e6d7b9"), t(18, 1886, "INDEPENDENT RULES AUDIT", 13, "#614c37", "label"),
              t(18, 1915, "Python referee", 23, INK, "display"),
              t(18, 1939, "5,086 played positions matched.", 16.5, INK),
              t(18, 1960, "One Hellfire ruling affects 39 cases.", 16.5, INK)]
    else:
        a += [t(34, 480, "OTHER KIRO CLI WORKFLOWS", 13.5, GOLD, "label"),
              path("M286 475h580", stroke="#62695e")]
        a += workflow(32, 497, 407, "forge", m) + workflow(461, 497, 407, "balance", m)
        a += [path("M34 771h832M34 825h832", stroke="#647167"),
              t(35, 804, "Later Billy audit", 18.5, PALE, "head"),
              t(222, 807, f"{m['baseline']} → {m['proposal']}", 27, GOLD, "display"),
              t(527, 803, f"Cowboy wins in {m['duels']} bot duels.", 17, QUIET)]
        a += other_checks(m, False) + release_switch(False)
        a += [rect(0, 1182, w, 76, "#e6d7b9"), rect(0, 1182, w, 76, "url(#paper)"),
              t(34, 1209, "INDEPENDENT RULES AUDIT", 12, "#614c37", "label"),
              t(33, 1236, "Python referee", 23, INK, "display"),
              path("M272 1199v42", stroke="#aa9677"), t(296, 1216, "5,086 played positions matched in 100 frozen duels.", 17, INK, "head"),
              t(296, 1239, "One ruling on empty-board Hellfire affects 39 alternate moves.", 17, INK)]
    description = (f"Separate recorded Kiro workflows. The Cautious Sheriff and Reckless Wizard each wrote a "
        f"playbook. The arena referee ran {m['series']} games and verified a replay. Sheriff won {m['sheriff']}, "
        f"Wizard {m['wizard']}. Card Forge tested Dusty Pete in a sandbox. The balance reviewer passed a Billy "
        f"proposal for human review. The later {m['duels']}-duel audit is separate. The Outrider hook, installed "
        "Power, scheduled Night Watch, release review and independent Python audit are separate checks. Full text and records "
        "are linked beneath the diagram in the repository README.")
    return frame(w, h, a, art, description)


def draw_poster(m, art):
    """Draw the landscape map, keeping each recorded workflow on its own rail."""
    w, h = 1280, 840
    border = "#68746a"
    a = [
        use("town", 718, 0, 562, 134),
        rect(718, 0, 562, 134, "url(#sky-shade)"),
        rect(0, 0, 718, 134, "#161c20"),
        rect(717, 0, 173, 134, "url(#header-ink)"),
        t(33, 34, "COWBOYS VS. WIZARDS", 16, GOLD, "label"),
        path("M275 28h45m-6-4 7 4-7 4", stroke=GOLD, sw=1.7),
        t(337, 34, "KIRO WORKFLOW MAP", 16, PALE, "label"),
        t(30, 88, "Inside the Night Shift", 53, PALE, "display"),
        t(34, 118, "How Kiro agents write playbooks, test card designs and review a release.", 21, QUIET),
        path("M0 135h1280M0 139h1280", stroke="#ac936f"),
        t(33, 177, "Saloon Agent Arena", 31, PALE, "display"),
        t(1247, 174, "saloon-agent-arena", 17, SAGE, "code", "end"),
        path("M370 169h649", stroke=border),
    ]
    for y, image, title, policy, accent, ground, delay in [
        (190, "sheriff", "Cautious Sheriff", "Writes one trap-first playbook.", GOLD, "#332c26", 0),
        (274, "wizard", "Reckless Wizard", "Writes one spell-first playbook.", VIOLET, "#302c39", 1),
    ]:
        a += [
            plate(34, y, 357, 72, ground, accent, 4),
            use(image, 39, y + 4, 54, 64),
            t(108, y + 31, title, 25, PALE, "display"),
            t(108, y + 57, policy, 18, QUIET),
            illuminate(34, y, 357, 72, accent, delay, 4),
        ]

    # Both playbooks feed the same referee. Neither persona runs the engine.
    a += [
        signal("M392 226h32q8 0 12 8l8 15q4 8 12 8h29", GOLD, 0),
        signal("M392 310h32q8 0 12-8l8-15q4-8 12-8h29", VIOLET, 1),
        path("m479 252 9 5-9 5z", GOLD),
        path("m479 274 9 5-9 5z", VIOLET),
        plate(492, 208, 303, 119, "#2b3634", "#9aab91"),
        dispatch_stamp(510, 222, "referee", SAGE),
        t(551, 245, "Arena referee", 27, PALE, "display"),
        t(512, 279, f"Runs {m['deals']} deals from both seats.", 19, PALE),
        t(512, 305, "Replays every recorded choice.", 18, QUIET),
        illuminate(492, 208, 303, 119, SAGE, 3.1),
        signal("M796 268h82", SAGE, 3),
        path("m871 262 11 6-11 6z", SAGE),
        plate(886, 195, 361, 145, "#ebe2c9", "#bda980", 5),
        rect(892, 201, 349, 133, "url(#paper)"),
        t(906, 222, f"WINS IN {m['series']} SEEDED DUELS", 17, "#465648", "label"),
        t(905, 254, f"{m['sheriff']} Sheriff", 26, "#794717", "display"),
        t(1227, 254, f"{m['wizard']} Wizard", 26, "#62477c", "display", "end"),
    ]
    step = 322 / m["series"]
    for i in range(m["series"]):
        a.append(rect(round(906 + step * i, 2), 266, round(step - 2, 2), 9,
                      "#96581f" if i < m["sheriff"] else "#705391"))
    a += [
        t(906, 303, f"Seed {m['replay_seed']} replay", 18.5, INK, "head"),
        t(906, 326, f"All {m['decisions']} decisions verified.", 18.5, INK),
        illuminate(886, 195, 361, 145, SAGE, 5.2, 5),
        t(33, 388, "Independent card reviews", 29, PALE, "display"),
        path("M453 380h793", stroke=border),
    ]

    # These work orders have separate inputs and reviewers. Their signals never join.
    jobs = [
        (403, "Card Forge", "player-card-forge", "Card author", "Drafts one sandbox card.",
         "Forge reviewer", "Tests both decks on paired deals.", m["card"],
         f"Summoned in {m['summoned']} of {m['candidate']} duels.", "#f3e3c3", "#795018", "#bc9e70", 4),
        (497, "Balance review", "night-shift-review", "Balancer", "Edits one stat on a copy.",
         "Balance reviewer", "Tests up to six proposed edits.", "Billy’s attack, 2 → 1",
         "Alex and Fable decide.", "#e8dfee", "#61467e", "#af99b7", 6.4),
    ]
    for y, title, slug, owner, scope, reviewer, check, result, detail, paper, ink, ruling, delay in jobs:
        a += [
            plate(34, y, 1213, 81, paper, ruling, 5),
            rect(40, y + 5, 1201, 71, "url(#paper)"),
            path(f"M267 {y+12}v57", stroke=ruling),
            t(53, y+34, title, 26, INK, "display"),
            t(54, y+60, slug, 15.5, ink, "code"),
            t(292, y+34, owner, 22, INK, "head"),
            t(292, y+60, scope, 17.5, INK),
            signal(f"M527 {y+42}h46", ink, delay),
            path(f"m566 {y+37} 9 5-9 5z", ink),
            t(593, y+34, reviewer, 22, INK, "head"),
            t(593, y+60, check, 17.5, INK),
            signal(f"M866 {y+42}h49", ink, delay+1.6),
            path(f"m908 {y+37} 9 5-9 5z", ink),
            t(936, y+34, result, 23.5, ink, "display"),
            t(936, y+60, detail, 18, INK),
            illuminate(927, y+8, 309, 65, ink, delay+3, 4),
        ]

    a += [
        t(53, 608, "Later Billy audit", 19, PALE, "head"),
        t(292, 611, f"{m['baseline']} → {m['proposal']}", 25, GOLD, "display"),
        t(648, 608, f"Cowboy wins across {m['duels']} bot duels.", 19, QUIET),
        '<g transform="translate(0 32)">',
    ]
    green, red = "#a8d8b8", "#f3a98d"
    a += [
        rect(0, 600, w, 108, "#29312e"),
        path("M0 600h1280M0 708h1280", stroke=border),
        t(33, 641, "Release review", 28, PALE, "display"),
        t(34, 671, "wf-code-reviewer", 17, SAGE, "code"),
        plate(284, 617, 269, 72, "#202a27", "#83978a", 5),
        t(301, 648, "Check commit ID", 20.5, PALE, "head"),
        t(301, 674, "Read-only checkout.", 18, QUIET),
        signal("M554 653h31q8 0 15-7l7-7q6-6 14-6h27", green, 9),
        signal("M554 653h31q8 0 15 7l7 7q6 6 14 6h27", red, 11),
        pin(554, 653, PALE),
        path("m641 628 9 5-9 5z", green),
        path("m641 668 9 5-9 5z", red),
        t(674, 640, "Match", 21, green, "head"),
        t(816, 640, "Run Node and Chrome checks. Verify the receipt.", 19, PALE),
        t(674, 680, "Mismatch", 21, red, "head"),
        t(816, 680, "Refuse before the game checks run.", 19, PALE),
    ]
    tools = [
        (34, "hook", GOLD, "Outrider save hook", f"Flags {m['cases']} stale replays."),
        (345, "power", VIOLET, "Orb Duel Review Power", f"Played {m['power']} legal actions."),
        (660, "crew", SAGE, "Night Watch Crew", f"{m['crew_games']} duels per revision."),
        (975, "referee", "#dfc8a0", "Python rules audit", "5,086 played positions matched."),
    ]
    for x, mark, accent, title, detail in tools:
        a += [dispatch_stamp(x, 733, mark, accent),
              t(x+36, 754, title, 20.5, PALE, "head"),
              t(x, 783, detail, 18.5, QUIET)]
    for x in [326, 641, 956]:
        a.append(path(f"M{x} 728v59", stroke="#515d56"))
    a.append("</g>")
    desc = (f"Kiro's Cautious Sheriff and Reckless Wizard each write their own playbook. "
            f"The Arena referee plays {m['series']} duels from both starting seats, then verifies "
            f"all {m['decisions']} decisions in the recorded replay. Separate Card Forge and balance "
            "workflows send a sandbox draft to an independent reviewer. Alex and Fable decide "
            "whether Billy's proposed change enters the game. A read-only release review checks "
            "the commit before running Node and Chrome. The footer shows separate checks.")
    return frame(w, h, a, art, desc)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare the published SVGs without writing them")
    args = parser.parse_args()
    data, plates = read_results(), artwork()
    layouts = {
        "frontier-workflow-map.svg": draw_poster(data, plates),
        "frontier-night-shift.svg": draw(data, plates, False),
        "frontier-night-shift-mobile.svg": draw(data, plates, True),
    }
    for filename, rendered in layouts.items():
        target = MEDIA / filename
        if args.check:
            if not target.is_file() or target.read_text() != rendered:
                raise SystemExit(f"Regenerate {target.name}")
        else:
            target.write_text(rendered)
