"""Phone and tablet layouts for the pixel workflow map."""

from .graphics import (BG, BOARD, CREAM, EDGE, FAIL, GOLD, MINT, MUTED, PURPLE,
                       arena_view, ico, lamp, panel, rect, wire)
from .lettering import bit, bit_width


def draw_compact(m, phone):
    """Compose the narrow editions on a native pixel grid, laid out top to bottom."""
    w = 240 if phone else 320
    inset = 8 if phone else 12
    content = w - inset * 2
    mid = w // 2
    parts = []

    def label(x, y, words, height, color, anchor="start", room=None):
        if room is not None and bit_width(words, height) > room:
            height *= room / bit_width(words, height)
        parts.append(bit(x, y, words, height, color, anchor))

    def section(y, title, color):
        label(inset, y, title, 9, color)
        end = inset + round(bit_width(title, 9)) + 8
        parts.append(rect(end, y - 4, w - inset - end, 1, EDGE))

    label(inset, 15, "COWBOYS VS. WIZARDS", 7, GOLD)
    label(inset, 37, "KIRO'S NIGHT SHIFT", 16 if phone else 19, CREAM)
    parts.append(arena_view(0, 42, w))
    y = 42 + round(w * 134 / 240) + 13
    section(y, "SALOON AGENT ARENA", CREAM)
    y += 8

    # Two independently written playbooks enter a single referee.
    gap = 8
    lane_w = (content - gap) // 2
    for x, name, style, color, fill in (
        (inset, "CAUTIOUS SHERIFF", "TRAP-FIRST", GOLD, "#382e24"),
        (w - inset - lane_w, "RECKLESS WIZARD", "SPELL-FIRST", PURPLE, "#302b40"),
    ):
        parts.append(panel(x, y, lane_w, 39, fill, EDGE))
        label(x + 6, y + 12, name, 8, color, room=lane_w - 12)
        label(x + 6, y + 23, style, 7, CREAM)
        label(x + 6, y + 33, "PLAYBOOK", 7, MUTED)
    input_y = y + 39
    join = input_y + 9
    referee_y = join + 8
    centers = (inset + lane_w // 2, w - inset - lane_w // 2)
    parts.append(wire([(centers[0], input_y), (centers[0], join), (mid-1, join), (mid-1, referee_y)], GOLD, 0))
    parts.append(wire([(centers[1], input_y), (centers[1], join), (mid+1, join), (mid+1, referee_y)], PURPLE, 0.6))

    ref_x = inset + (7 if phone else 19)
    ref_w = w - ref_x * 2
    parts.append(panel(ref_x, referee_y, ref_w, 31, BOARD, EDGE))
    parts.append(ico("prop-referee", ref_x + 5, referee_y + 3, 25))
    label(ref_x + 34, referee_y + 12, "ARENA REFEREE", 9, MINT)
    label(ref_x + 34, referee_y + 24, f"{m['deals']} DEALS FROM BOTH SEATS", 7, CREAM)
    score_y = referee_y + 40
    parts.append(wire([(mid, referee_y + 31), (mid, score_y)], MINT, 2))

    # Bar length represents the actual number of wins, one tile per duel.
    parts.append(panel(inset, score_y, content, 80, "#192b31", EDGE))
    label(mid, score_y + 12, f"RECORDED SCORE / {m['series']} DUELS", 7, MUTED, "middle")
    label(inset + 8, score_y + 36, str(m["sheriff"]), 17, GOLD)
    label(inset + 8 + bit_width(str(m["sheriff"]), 17) + 5, score_y + 34, "SHERIFF", 8, CREAM)
    label(w - inset - 8, score_y + 36, str(m["wizard"]), 17, PURPLE, "end")
    label(w - inset - 13 - bit_width(str(m["wizard"]), 17), score_y + 34, "WIZARD", 8, CREAM, "end")
    bar_x = inset + 8
    bar_width = content - 16
    for i in range(m["series"]):
        left = round(i * bar_width / m["series"])
        right = round((i + 1) * bar_width / m["series"])
        parts.append(rect(bar_x + left, score_y + 43, right - left - 1, 4,
                          GOLD if i < m["sheriff"] else PURPLE))
    label(inset + 8, score_y + 61, f"SEED {m['replay_seed']} REPLAY", 8, CREAM)
    label(inset + 8, score_y + 73, f"ALL {m['decisions']} DECISIONS VERIFIED", 7, MINT)
    y = score_y + 98
    section(y, "CARD WORKSHOPS", CREAM)
    y += 8

    # Request, reviewer and measured outcome share a panel in each workshop.
    shop_w = content if phone else (content - gap) // 2
    forge_h = 91
    balance_h = 117
    shops_h = (forge_h + gap + balance_h) if phone else balance_h
    forge_x = inset
    balance_x = inset if phone else w - inset - shop_w
    balance_y = y + forge_h + gap if phone else y
    for x, yy, h, prop, title, accent in (
        (forge_x, y, forge_h if phone else shops_h, "forge", "CARD FORGE", GOLD),
        (balance_x, balance_y, balance_h, "balance", "BALANCE LAB", PURPLE),
    ):
        parts.append(panel(x, yy, shop_w, h, BOARD, EDGE))
        parts.append(ico("prop-" + prop, x + 5, yy + 3, 25))
        label(x + 32, yy + 17, title, 9, accent)
        delay = 4 if prop == "forge" else 6
        end = x + shop_w - 11
        parts.append(wire([(end - 12, yy + 13), (end, yy + 13)], accent, delay))
        parts.append(lamp(end, yy + 11, 4, accent, delay + 0.6))
    fx = forge_x + 7
    label(fx, y + 37, "PLAYER REQUEST → AUTHOR", 7, CREAM, room=shop_w - 14)
    label(fx, y + 49, "REVIEWER TESTS THE DRAFT", 7, MUTED, room=shop_w - 14)
    parts.append(rect(fx, y + 56, shop_w - 14, 1, EDGE))
    label(fx, y + 71, m["card"], 10, GOLD)
    label(fx, y + 83, f"SUMMONED IN {m['summoned']}/{m['candidate']} DUELS", 7, CREAM, room=shop_w - 14)
    bx = balance_x + 7
    label(bx, balance_y + 37, "BILLY ATTACK 2 → 1", 8, CREAM)
    label(bx, balance_y + 49, "REVIEWER PASSED THE EDIT", 7, MUTED, room=shop_w - 14)
    parts.append(rect(bx, balance_y + 56, shop_w - 14, 1, EDGE))
    label(bx, balance_y + 69, f"LATER / {m['duels']} BOT DUELS", 7, CREAM, room=shop_w - 14)
    label(bx, balance_y + 80, "AUDIT / COWBOY WINS", 7, MUTED, room=shop_w - 14)
    label(bx, balance_y + 95, f"{m['baseline']} → {m['proposal']}", 9, PURPLE, room=shop_w - 14)
    label(bx, balance_y + 109, "ALEX + FABLE DECIDE", 7, CREAM)

    y += shops_h + 10
    parts.append(panel(inset, y, content, 77, "#182a2d", EDGE))
    parts.append(ico("prop-gate", inset + 5, y + 3, 24))
    label(inset + 32, y + 14, "RELEASE GATE", 9, CREAM)
    label(inset + 32, y + 25, "CHECK EXPECTED COMMIT ID", 7, MUTED)
    for target, color, delay in ((centers[0], MINT, 8), (centers[1], FAIL, 10)):
        parts.append(wire([(mid, y + 29), (mid, y + 34), (target, y + 34),
                           (target, y + 41)], color, delay))
        parts.append(lamp(target - 2, y + 40, 4, color, delay + 0.6))
    parts.append(rect(mid, y + 49, 1, 20, EDGE))
    label(inset + 8, y + 57, "MATCH", 7, MINT)
    label(inset + 8, y + 69, "RUN NODE + CHROME", 7, CREAM)
    label(mid + 8, y + 57, "MISMATCH", 7, FAIL)
    label(mid + 8, y + 69, "REFUSE THE RUN", 7, CREAM)
    y += 95
    section(y, "INDEPENDENT CHECKS", CREAM)
    y += 7
    checks = [
        ("hook", "OUTRIDER SAVE HOOK", f"{m['cases']} STALE REPLAYS", "AFTER A RULE EDIT", GOLD),
        ("power", "ORB DUEL MCP POWER", f"{m['power']} LEGAL ACTIONS", "COWBOY SEAT ONLY", PURPLE),
        ("crew", "NIGHT WATCH CREW", f"{m['crew_games']} DUELS / REVISION", "2 AM PACIFIC JOB", MINT),
        ("referee", "PYTHON RULES AUDIT", f"{m['rules_positions']} POSITIONS MATCH", "HELLFIRE RULING OPEN", GOLD),
    ]
    row_h = 43
    for i, (prop, title, detail, context, accent) in enumerate(checks):
        column = 0 if phone else i % 2
        row = i if phone else i // 2
        cw = content if phone else (content - gap) // 2
        xx = inset + column * (cw + gap)
        yy = y + row * row_h
        icon_w = 23 if phone else 20
        parts.append(ico("prop-" + prop, xx, yy + 3, icon_w))
        lx = xx + icon_w + 4
        label(lx, yy + 13, title, 8 if phone else 7, accent, room=cw - icon_w - 5)
        label(lx, yy + 25, detail, 7, CREAM, room=cw - icon_w - 5)
        label(lx, yy + 36, context, 7, MUTED, room=cw - icon_w - 5)
        parts.append(rect(xx, yy + 41, cw, 1, EDGE))
    h = y + (4 if phone else 2) * row_h + 8
    return w, h, rect(0, 0, w, h, BG) + "".join(parts)
