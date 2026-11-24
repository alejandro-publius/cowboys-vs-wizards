#!/usr/bin/env python3
"""Showdown single-duel referee.

An independent adjudicator written only from rules/RULEBOOK.md and
rules/cards.csv. Python standard library only, no network, no engine code.
SCHEMA.md (next to this file) documents the input and output contract and
every ruling the rulebook leaves open.

Usage:
    python3 proof/referee/referee.py --stream < duels.ndjson > results.ndjson
    python3 proof/referee/referee.py --check-catalog [path/to/cards.csv]
"""

import argparse
import copy
import csv
import json
import os
import re
import sys
from collections import namedtuple

REFEREE_SCHEMA_VERSION = 1

SIDES = ("cowboy", "wizard")
START_BASE = 5          # rule 1
OPENING_HAND = 4        # rule 3.1
SECOND_EXTRA = 1        # rule 3.2
HAND_LIMIT = 6          # rule 4.2
TROOP_SLOTS = 3         # rule 3.3
TRAP_SLOTS = 2          # rule 3.3 / 7
TURN_LIMIT = 80         # rule 10, "Running out of turns"

DEFAULT_CSV = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "rules", "cards.csv")
)

# ---------------------------------------------------------------------------
# Catalog: mechanical columns transcribed from rules/cards.csv.
# Frozen here so the referee does not change if the CSV changes; use
# --check-catalog to compare against the CSV.
# ---------------------------------------------------------------------------

Card = namedtuple(
    "Card", "name faction kind type rarity stars tributes attack orbs keywords"
)


def _troop(name, faction, ttype, rarity, stars, tributes, attack, orbs, keywords=()):
    return Card(name, faction, "Troop", ttype, rarity, stars, tributes, attack, orbs, tuple(keywords))


def _card(name, faction, kind, rarity):
    return Card(name, faction, kind, None, rarity, None, None, None, None, ())


CATALOG = (
    _troop("Sheriff", "Cowboy", "Lawman", "Basic", 2, 0, 1, 3),
    _troop("Billy", "Cowboy", "Outlaw", "Basic", 5, 1, 2, 4),
    _troop("Mounted Billy", "Cowboy", "Outlaw", "Rare", 7, 2, 3, 5, ["Ride"]),
    _card("Deadeye", "Cowboy", "Spell", "Common"),
    _troop("Captured Dragon", "Cowboy", "Beast", "Legendary", 5, 1, 4, 2, ["Sweep"]),
    _troop("Captured Wraith", "Cowboy", "Undead", "Legendary", 3, 0, 2, 2, ["Ghostly"]),
    _troop("Covered Wagon", "Cowboy", "Rig", "Common", 4, 0, 1, 4, ["Guard"]),
    _troop("Outrider", "Cowboy", "Lawman", "Common", 3, 0, 1, 3, ["Ride"]),
    _troop("Dynamiter", "Cowboy", "Outlaw", "Uncommon", 3, 0, 3, 1, ["Last Stand"]),
    _troop("Ranger", "Cowboy", "Lawman", "Uncommon", 5, 1, 2, 4, ["Scout"]),
    _troop("Gatling Crew", "Cowboy", "Rig", "Rare", 7, 2, 4, 4, ["Sweep"]),
    _card("Lasso", "Cowboy", "Spell", "Uncommon"),
    _troop("Skeleton", "Wizard", "Undead", "Basic", 1, 0, 1, 3),
    _troop("Wizard", "Wizard", "Mage", "Uncommon", 5, 1, 2, 4, ["Raise"]),
    _troop("Dragon", "Wizard", "Beast", "Legendary", 8, 2, 3, 5, ["Sweep"]),
    _card("Singularity", "Wizard", "Spell", "Common"),
    _troop("Lantern Wraith", "Wizard", "Undead", "Legendary", 6, 1, 2, 4, ["Ghostly"]),
    _troop("Imp", "Wizard", "Fiend", "Uncommon", 2, 0, 3, 1, ["Quickdraw"]),
    _card("Bear Trap", "Cowboy", "Trap", "Uncommon"),
    _card("Six-Shooter", "Cowboy", "Gear", "Uncommon"),
    _card("Sheriff's Office", "Cowboy", "Location", "Rare"),
    _troop("Bone Wall", "Wizard", "Undead", "Common", 3, 0, 0, 4, ["Guard"]),
    _troop("Raven Familiar", "Wizard", "Beast", "Common", 2, 0, 1, 1, ["Scout"]),
    _troop("Headless Horseman", "Wizard", "Undead", "Rare", 5, 1, 2, 3, ["Ride"]),
    _troop("Jack-o'-Lantern", "Wizard", "Fiend", "Common", 1, 0, 1, 1, ["Last Stand"]),
    _card("Hellfire", "Wizard", "Spell", "Uncommon"),
    _card("Hex", "Wizard", "Trap", "Uncommon"),
    _card("Bone Armor", "Wizard", "Gear", "Uncommon"),
    _card("Boneyard", "Wizard", "Location", "Rare"),
)

CARDS = {c.name: c for c in CATALOG}

KNOWN_KEYWORDS = {"Guard", "Quickdraw", "Ride", "Scout", "Raise", "Sweep", "Last Stand", "Ghostly"}

# Card text ("What it does") turned into effects.
SPELL_EFFECTS = {
    "Deadeye": "damage-one",       # Remove 1 orb from an enemy troop.
    "Singularity": "damage-one",   # Remove 1 orb from an enemy troop.
    "Lasso": "stun",               # Stun an enemy troop.
    "Hellfire": "damage-all",      # Remove 1 orb from every enemy troop.
}
TRAP_EFFECTS = {
    "Bear Trap": "bite-2",   # attacker loses 2 orbs first; if defeated the attack never lands
    "Hex": "cancel",         # the attack is cancelled
}
GEAR_EFFECTS = {
    "Six-Shooter": {"attack": 1, "orbs": 0},
    "Bone Armor": {"attack": 0, "orbs": 2},
}
LOCATION_EFFECTS = {
    "Sheriff's Office": ("Lawman", 1),
    "Boneyard": ("Undead", 1),
}


def tributes_for_stars(stars):
    """Rule 2: 1-4 stars free, 5-6 one tribute, 7+ two."""
    if stars <= 4:
        return 0
    if stars <= 6:
        return 1
    return 2


def slugify(name, apostrophe=""):
    s = name.lower().replace("'", apostrophe)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


SLUGS = {}
for _c in CATALOG:
    # "Sheriff's Office" -> "sheriffs-office" (primary) and "sheriff-s-office" (alias).
    for _variant in ("", "-"):
        SLUGS.setdefault(slugify(_c.name, _variant), _c.name)

INSTANCE_RE = re.compile(r"([a-z0-9]+(?:-[a-z0-9]+)*)-([0-9]+)")


def has_effect(card):
    if card.kind == "Troop":
        return all(k in KNOWN_KEYWORDS for k in card.keywords)
    table = {"Spell": SPELL_EFFECTS, "Trap": TRAP_EFFECTS, "Gear": GEAR_EFFECTS,
             "Location": LOCATION_EFFECTS}.get(card.kind)
    return table is not None and card.name in table


def check_catalog(csv_path):
    """Compare the frozen catalog with the printed CSV. Returns a list of problems."""
    problems = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    def num(v):
        v = (v or "").strip()
        return int(v) if v else None

    seen = set()
    for row in rows:
        name = (row.get("Card") or "").strip()
        ours = CARDS.get(name)
        if ours is None:
            problems.append("csv card missing from referee catalog: %r" % name)
            continue
        seen.add(name)
        printed = Card(
            name,
            row["Faction"].strip(),
            row["Kind"].strip(),
            row["Type"].strip() or None,
            row["Rarity"].strip(),
            num(row["Stars"]),
            num(row["Tributes to summon"]),
            num(row["Attack"]),
            num(row["Orbs"]),
            tuple(k.strip() for k in (row["Keywords"] or "").split(",") if k.strip()),
        )
        if printed != ours:
            problems.append("mismatch for %r: csv=%r referee=%r" % (name, printed, ours))
        if ours.kind == "Troop" and tributes_for_stars(ours.stars) != ours.tributes:
            problems.append("%r: stars %d imply %d tributes but card says %d"
                            % (name, ours.stars, tributes_for_stars(ours.stars), ours.tributes))
        if not has_effect(ours):
            problems.append("%r has no implemented effect" % name)
    for name in CARDS:
        if name not in seen:
            problems.append("referee catalog card not in csv: %r" % name)
    return problems


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class InvalidDuel(Exception):
    """The duel input itself cannot be adjudicated."""


class Illegal(Exception):
    """An action is rejected; state stays unchanged."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def other(side):
    return "wizard" if side == "cowboy" else "cowboy"


def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def parse_slot(value, count):
    if not is_int(value):
        raise Illegal("malformed-action")
    if not 0 <= value < count:
        raise Illegal("slot-out-of-range")
    return value


def resolve_card_name(instance_id, card_names=None):
    """Decode an instance ID to a printed card name.

    Order: cardNames[instance_id], then cardNames[catalog_id], then the slug
    of the catalog ID (instance ID minus its numeric copy suffix).
    """
    m = INSTANCE_RE.fullmatch(instance_id)
    base = m.group(1) if m else None
    if card_names:
        name = card_names.get(instance_id)
        if name is None and base is not None:
            name = card_names.get(base)
        if name is not None:
            if name not in CARDS:
                raise InvalidDuel("cardNames maps %r to unknown card %r" % (instance_id, name))
            return name
    if m is None:
        raise InvalidDuel("instance id %r is not '<catalog-id>-<copy number>'" % instance_id)
    name = SLUGS.get(base)
    if name is None:
        raise InvalidDuel("unknown card in instance id %r" % instance_id)
    return name


def fresh_allowances():
    return {"troop": True, "other": True, "trap": True, "cards": True}


# ---------------------------------------------------------------------------
# Duel
# ---------------------------------------------------------------------------

class Duel:
    def __init__(self, duel):
        if not isinstance(duel, dict):
            raise InvalidDuel("duel is not a JSON object")
        self.seed = duel.get("seed")
        first = duel.get("first")
        if first not in SIDES:
            raise InvalidDuel("first must be 'cowboy' or 'wizard'")
        decks = duel.get("decks")
        if not isinstance(decks, dict) or set(decks) != set(SIDES):
            raise InvalidDuel("decks must have exactly the keys 'cowboy' and 'wizard'")
        card_names = duel.get("cardNames")
        if card_names is not None:
            if not isinstance(card_names, dict) or not all(
                isinstance(k, str) and isinstance(v, str) for k, v in card_names.items()
            ):
                raise InvalidDuel("cardNames must map strings to printed card names")
        self.names = {}
        for side in SIDES:
            deck = decks[side]
            if not isinstance(deck, list) or not all(isinstance(i, str) for i in deck):
                raise InvalidDuel("%s deck must be a list of instance id strings" % side)
            if len(set(deck)) != len(deck):
                raise InvalidDuel("duplicate instance id in %s deck" % side)
            for iid in deck:
                name = resolve_card_name(iid, card_names)
                if self.names.get(iid, name) != name:
                    raise InvalidDuel("instance id %r names two different cards" % iid)
                self.names[iid] = name
        actions = duel.get("actions")
        if not isinstance(actions, list):
            raise InvalidDuel("actions must be a list")
        self.actions = actions
        self.state = self._setup(first, decks)

    # -- helpers ------------------------------------------------------------

    def card(self, iid):
        return CARDS[self.names[iid]]

    def attack_of(self, st, troop):
        card = self.card(troop["id"])
        value = card.attack
        for g in troop["gear"]:
            value += GEAR_EFFECTS[self.names[g]]["attack"]
        loc = st["location"]
        if loc is not None:
            ltype, bonus = LOCATION_EFFECTS[self.names[loc["id"]]]
            if card.type == ltype:
                value += bonus
        return value

    @staticmethod
    def over(st):
        return st["reason"] is not None

    def _setup(self, first, decks):
        st = {
            "turn": 1,
            "active": first,
            "first": first,
            "winner": None,
            "reason": None,
            "location": None,
            "allowances": fresh_allowances(),
            "players": {
                s: {
                    "base": START_BASE,
                    "hand": [],
                    "deck": list(decks[s]),
                    "discard": [],
                    "troops": [None] * TROOP_SLOTS,
                    "traps": [None] * TRAP_SLOTS,
                }
                for s in SIDES
            },
        }
        for s in SIDES:
            p = st["players"][s]
            count = OPENING_HAND + (0 if s == first else SECOND_EXTRA)
            for _ in range(count):
                if p["deck"]:  # ruling R4: setup from an empty deck draws nothing
                    p["hand"].append(p["deck"].pop(0))
        return st

    def _damage_base(self, st, side, amount):
        p = st["players"][side]
        p["base"] = max(0, p["base"] - amount)
        if p["base"] == 0 and not self.over(st):
            st["winner"] = other(side)
            st["reason"] = "base-destroyed"

    def _draw(self, st, side, scout=False):
        p = st["players"][side]
        if not p["deck"]:
            if not scout:
                self._damage_base(st, side, 1)
            return
        drawn = p["deck"].pop(0)
        if len(p["hand"]) >= HAND_LIMIT:
            p["discard"].append(drawn)
        else:
            p["hand"].append(drawn)

    def _defeat(self, st, side, slot):
        p = st["players"][side]
        troop = p["troops"][slot]
        p["troops"][slot] = None
        p["discard"].append(troop["id"])
        p["discard"].extend(troop["gear"])

    def _lose_orbs(self, st, side, slot, amount):
        """Remove orbs from a troop. Returns True if it was defeated. Never touches a Base."""
        troop = st["players"][side]["troops"][slot]
        troop["orbs"] -= amount
        if troop["orbs"] <= 0:
            self._defeat(st, side, slot)
            return True
        return False

    def _arrive(self, st, side, iid, orbs, rest):
        troops = st["players"][side]["troops"]
        slot = troops.index(None)
        quick = "Quickdraw" in self.card(iid).keywords
        troops[slot] = {
            "id": iid,
            "orbs": orbs,
            "gear": [],
            "stunned": False,
            "cover": False,
            "rest": bool(rest and not quick),
            "acted": False,
        }
        return slot

    def _hand_card(self, st, action, kind):
        cid = action.get("cardId")
        if not isinstance(cid, str):
            raise Illegal("malformed-action")
        p = st["players"][st["active"]]
        if cid not in p["hand"]:
            raise Illegal("card-not-in-hand")
        card = self.card(cid)
        if card.kind != kind:
            raise Illegal("wrong-card-kind")
        if not st["allowances"]["cards"]:
            raise Illegal("cards-locked")
        return cid, card, p

    # -- actions ------------------------------------------------------------

    def _summon(self, st, a):
        cid, card, p = self._hand_card(st, a, "Troop")
        side = st["active"]
        if not st["allowances"]["troop"]:
            raise Illegal("troop-already-played")
        tributes = a.get("tributes", [])
        if not isinstance(tributes, list):
            raise Illegal("malformed-action")
        slots = [parse_slot(t, TROOP_SLOTS) for t in tributes]
        if len(set(slots)) != len(slots):
            raise Illegal("duplicate-tribute")
        for s in slots:
            if p["troops"][s] is None:
                raise Illegal("tribute-slot-empty")
        if len(slots) != card.tributes:
            raise Illegal("wrong-tribute-count")
        if not any(p["troops"][i] is None or i in slots for i in range(TROOP_SLOTS)):
            raise Illegal("board-full")

        p["hand"].remove(cid)
        for s in slots:  # ruling R6: tributes in listed order, each followed by its gear
            self._defeat(st, side, s)
        st["allowances"]["troop"] = False
        self._arrive(st, side, cid, card.orbs, rest=(card.tributes == 0))

        if "Scout" in card.keywords:
            self._draw(st, side, scout=True)
        if "Raise" in card.keywords and None in p["troops"]:
            for idx in range(len(p["discard"]) - 1, -1, -1):
                c = self.card(p["discard"][idx])
                if c.kind == "Troop" and c.type == "Undead":
                    iid = p["discard"].pop(idx)
                    self._arrive(st, side, iid, 1, rest=True)
                    break

    def _target_arg(self, a):
        has_t, has_s = "target" in a, "slot" in a
        if has_t and has_s and a["target"] != a["slot"]:
            raise Illegal("malformed-action")
        if has_t:
            return a["target"]
        return a.get("slot")

    def _spell(self, st, a):
        cid, card, p = self._hand_card(st, a, "Spell")
        if not st["allowances"]["other"]:
            raise Illegal("other-card-already-played")
        effect = SPELL_EFFECTS[card.name]
        foe = other(st["active"])
        foe_troops = st["players"][foe]["troops"]
        target = self._target_arg(a)
        t = None
        if effect in ("damage-one", "stun"):
            if target is None:
                raise Illegal("target-required")
            t = parse_slot(target, TROOP_SLOTS)
            troop = foe_troops[t]
            if troop is None:
                raise Illegal("target-slot-empty")
            if "Ghostly" in self.card(troop["id"]).keywords:
                raise Illegal("target-ghostly")
            if effect == "stun" and troop["stunned"]:
                raise Illegal("already-stunned")
        elif target is not None:
            raise Illegal("spell-takes-no-target")

        p["hand"].remove(cid)
        st["allowances"]["other"] = False
        if effect == "damage-one":
            self._lose_orbs(st, foe, t, 1)
        elif effect == "stun":
            foe_troops[t]["stunned"] = True
        else:
            for i in range(TROOP_SLOTS):
                if foe_troops[i] is not None:
                    self._lose_orbs(st, foe, i, 1)
        p["discard"].append(cid)

    def _gear(self, st, a):
        cid, card, p = self._hand_card(st, a, "Gear")
        if not st["allowances"]["other"]:
            raise Illegal("other-card-already-played")
        slot = parse_slot(a.get("slot"), TROOP_SLOTS)
        troop = p["troops"][slot]
        if troop is None:
            raise Illegal("gear-slot-empty")
        p["hand"].remove(cid)
        st["allowances"]["other"] = False
        troop["gear"].append(cid)
        troop["orbs"] += GEAR_EFFECTS[card.name]["orbs"]

    def _location(self, st, a):
        cid, card, p = self._hand_card(st, a, "Location")
        if not st["allowances"]["other"]:
            raise Illegal("other-card-already-played")
        current = st["location"]
        if current is not None and self.names[current["id"]] == card.name:
            raise Illegal("same-location-in-play")
        p["hand"].remove(cid)
        st["allowances"]["other"] = False
        if current is not None:
            st["players"][current["owner"]]["discard"].append(current["id"])
        st["location"] = {"id": cid, "owner": st["active"]}

    def _set(self, st, a):
        cid, card, p = self._hand_card(st, a, "Trap")
        if not st["allowances"]["trap"]:
            raise Illegal("trap-already-set")
        if None not in p["traps"]:
            raise Illegal("trap-slots-full")
        p["hand"].remove(cid)
        st["allowances"]["trap"] = False
        p["traps"][p["traps"].index(None)] = {"id": cid, "setTurn": st["turn"]}

    def _cover(self, st, a):
        p = st["players"][st["active"]]
        slot = parse_slot(a.get("slot"), TROOP_SLOTS)
        troop = p["troops"][slot]
        if troop is None:
            raise Illegal("troop-slot-empty")
        if troop["acted"]:
            raise Illegal("troop-already-acted")
        troop["acted"] = True
        troop["cover"] = True
        st["allowances"]["cards"] = False

    def _attack(self, st, a):
        side = st["active"]
        foe = other(side)
        mine = st["players"][side]["troops"]
        theirs = st["players"][foe]["troops"]
        slot = parse_slot(a.get("slot"), TROOP_SLOTS)
        attacker = mine[slot]
        if attacker is None:
            raise Illegal("troop-slot-empty")
        if st["turn"] == 1:
            raise Illegal("no-attacks-on-turn-1")
        if attacker["acted"]:
            raise Illegal("troop-already-acted")
        if attacker["rest"]:
            raise Illegal("troop-resting")
        if attacker["stunned"]:
            raise Illegal("troop-stunned")
        acard = self.card(attacker["id"])
        atk = self.attack_of(st, attacker)
        if atk <= 0:
            raise Illegal("zero-attack")

        target = a.get("target")
        enemies = [i for i in range(TROOP_SLOTS) if theirs[i] is not None]
        guards = [i for i in enemies if "Guard" in self.card(theirs[i]["id"]).keywords]
        if target == "base":
            if not enemies:
                mode, base_damage = "direct", atk
            elif "Ride" in acard.keywords:
                if guards:
                    raise Illegal("guard-blocks-ride")
                mode, base_damage = "ride", 1
            else:
                raise Illegal("base-protected")
            t = None
        else:
            t = parse_slot(target, TROOP_SLOTS)
            if theirs[t] is None:
                raise Illegal("target-slot-empty")
            if guards and t not in guards:
                raise Illegal("must-attack-guard")
            mode = "fight"

        attacker["acted"] = True
        st["allowances"]["cards"] = False

        if self._spring_trap(st, foe, side, slot):
            return
        if mode != "fight":
            self._damage_base(st, foe, base_damage)
            return
        self._fight(st, side, slot, foe, t, atk)

    def _spring_trap(self, st, defender, attacker_side, attacker_slot):
        """Rule 7: the defender's oldest face-down trap springs. True if the attack ends."""
        traps = st["players"][defender]["traps"]
        live = [(trap["setTurn"], i) for i, trap in enumerate(traps) if trap is not None]
        if not live:
            return False
        _, i = min(live)
        trap = traps[i]
        traps[i] = None
        st["players"][defender]["discard"].append(trap["id"])
        effect = TRAP_EFFECTS[self.names[trap["id"]]]
        if effect == "cancel":
            return True
        return self._lose_orbs(st, attacker_side, attacker_slot, 2)

    def _fight(self, st, side, aslot, foe, tslot, atk):
        attacker = st["players"][side]["troops"][aslot]
        target = st["players"][foe]["troops"][tslot]
        acard = self.card(attacker["id"])
        tcard = self.card(target["id"])

        before = target["orbs"]
        target["orbs"] -= atk
        target_down = target["orbs"] <= 0
        attacker_down = False
        if target_down:
            overflow = atk - before
            in_cover = target["cover"]
            self._defeat(st, foe, tslot)
            if overflow > 0 and not in_cover:
                self._damage_base(st, foe, overflow)
        elif not target["cover"]:
            hit_back = self.attack_of(st, target)
            if hit_back > 0:
                attacker_down = self._lose_orbs(st, side, aslot, hit_back)

        # Last Stand (ruling R8): fires only when the opposing troop is still on the board.
        if target_down and not attacker_down and "Last Stand" in tcard.keywords:
            self._lose_orbs(st, side, aslot, 1)
        if attacker_down and not target_down and "Last Stand" in acard.keywords:
            self._lose_orbs(st, foe, tslot, 1)

        # Sweep (ruling R9): after the fight is settled, every other enemy troop.
        if "Sweep" in acard.keywords:
            for i in range(TROOP_SLOTS):
                if i != tslot and st["players"][foe]["troops"][i] is not None:
                    self._lose_orbs(st, foe, i, 1)

    def _end(self, st, a):
        side = st["active"]
        for troop in st["players"][side]["troops"]:
            if troop is not None:
                troop["stunned"] = False
        if st["turn"] >= TURN_LIMIT:
            cb = st["players"]["cowboy"]["base"]
            wb = st["players"]["wizard"]["base"]
            if cb == wb:
                st["winner"], st["reason"] = None, "turn-limit-draw"
            else:
                st["winner"] = "cowboy" if cb > wb else "wizard"
                st["reason"] = "turn-limit"
            return
        nxt = other(side)
        st["turn"] += 1
        st["active"] = nxt
        for troop in st["players"][nxt]["troops"]:
            if troop is not None:
                troop["acted"] = False
                troop["rest"] = False
                troop["cover"] = False
        st["allowances"] = fresh_allowances()
        self._draw(st, nxt)

    HANDLERS = {
        "summon": _summon,
        "spell": _spell,
        "gear": _gear,
        "location": _location,
        "set": _set,
        "attack": _attack,
        "cover": _cover,
        "end": _end,
    }

    def apply(self, st, action):
        if not isinstance(action, dict) or not isinstance(action.get("type"), str):
            raise Illegal("malformed-action")
        handler = self.HANDLERS.get(action["type"])
        if handler is None:
            raise Illegal("unsupported-action-type:" + action["type"][:64])
        if self.over(st):
            raise Illegal("game-over")
        handler(self, st, action)

    # -- output -------------------------------------------------------------

    def normalize(self, st):
        def troop_out(t):
            if t is None:
                return None
            c = self.card(t["id"])
            statuses = []
            if t["cover"]:
                statuses.append("cover")
            if t["stunned"]:
                statuses.append("stunned")
            return {
                "id": t["id"],
                "card": c.name,
                "type": c.type,
                "attack": self.attack_of(st, t),
                "orbs": t["orbs"],
                "gear": list(t["gear"]),
                "statuses": statuses,
                "rest": t["rest"],
                "acted": t["acted"],
            }

        def trap_out(t):
            if t is None:
                return None
            return {"id": t["id"], "card": self.names[t["id"]], "setTurn": t["setTurn"]}

        loc = st["location"]
        return {
            "turn": st["turn"],
            "active": st["active"],
            "first": st["first"],
            "over": self.over(st),
            "winner": st["winner"],
            "reason": st["reason"],
            "location": None if loc is None else {
                "id": loc["id"], "card": self.names[loc["id"]], "owner": loc["owner"]},
            "allowances": dict(st["allowances"]),
            "players": {
                s: {
                    "base": st["players"][s]["base"],
                    "hand": list(st["players"][s]["hand"]),
                    "deck": list(st["players"][s]["deck"]),
                    "discard": list(st["players"][s]["discard"]),
                    "troops": [troop_out(t) for t in st["players"][s]["troops"]],
                    "traps": [trap_out(t) for t in st["players"][s]["traps"]],
                }
                for s in SIDES
            },
        }

    def run(self):
        initial = self.normalize(self.state)
        steps = []
        unsupported = []
        for index, action in enumerate(self.actions):
            trial = copy.deepcopy(self.state)
            try:
                self.apply(trial, action)
            except Illegal as exc:
                if exc.code.startswith("unsupported-action-type:"):
                    unsupported.append("step %d: %s" % (index, exc.code))
                steps.append({"accepted": False, "state": self.normalize(self.state), "error": exc.code})
                continue
            self.state = trial
            steps.append({"accepted": True, "state": self.normalize(self.state), "error": None})
        return {"seed": self.seed, "initial": initial, "steps": steps, "unsupported": unsupported}


def run_duel(duel):
    try:
        return Duel(duel).run()
    except InvalidDuel as exc:
        seed = duel.get("seed") if isinstance(duel, dict) else None
        return {"seed": seed, "initial": None, "steps": [], "unsupported": ["invalid-duel: %s" % exc]}


def stream(in_file, out_file):
    for line in in_file:
        if not line.strip():
            continue
        try:
            duel = json.loads(line)
        except json.JSONDecodeError as exc:
            result = {"seed": None, "initial": None, "steps": [],
                      "unsupported": ["invalid-duel: malformed JSON (%s)" % exc.msg]}
        else:
            result = run_duel(duel)
        out_file.write(json.dumps(result, separators=(",", ":")) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Independent Showdown single-duel referee")
    ap.add_argument("--stream", action="store_true",
                    help="read NDJSON duels on stdin, write one JSON result per line")
    ap.add_argument("--check-catalog", nargs="?", const=DEFAULT_CSV, metavar="CSV",
                    help="compare the frozen catalog with cards.csv")
    args = ap.parse_args(argv)
    if args.check_catalog:
        problems = check_catalog(args.check_catalog)
        for p in problems:
            print(p)
        print("catalog OK" if not problems else "%d catalog problem(s)" % len(problems))
        return 1 if problems else 0
    if args.stream:
        stream(sys.stdin, sys.stdout)
        return 0
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
