"""Unit examples for the Showdown referee.

Every expectation here was worked out by hand from rules/RULEBOOK.md and
rules/cards.csv. None of it comes from an engine or a recorded snapshot.

Run: python3 -m unittest discover -s proof/referee -p 'test_*.py' -v
"""

import io
import json
import os
import subprocess
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import referee as R  # noqa: E402

END = {"type": "end"}


def ids(slug, n, start=1):
    return ["%s-%d" % (slug, i) for i in range(start, start + n)]


def duel(seed, first, cowboy, wizard, actions, **extra):
    d = {"seed": seed, "first": first, "decks": {"cowboy": cowboy, "wizard": wizard},
         "actions": actions}
    d.update(extra)
    return d


def summon(cid, tributes=()):
    return {"type": "summon", "cardId": cid, "tributes": list(tributes)}


def spell(cid, target=None):
    a = {"type": "spell", "cardId": cid}
    if target is not None:
        a["target"] = target
    return a


def gear(cid, slot):
    return {"type": "gear", "cardId": cid, "slot": slot}


def location(cid):
    return {"type": "location", "cardId": cid}


def set_trap(cid):
    return {"type": "set", "cardId": cid}


def attack(slot, target):
    return {"type": "attack", "slot": slot, "target": target}


def cover(slot):
    return {"type": "cover", "slot": slot}


class Base(unittest.TestCase):
    def play(self, d):
        """Run a duel and check the rejection invariant on every step."""
        result = R.run_duel(d)
        self.assertIsNotNone(result["initial"], result["unsupported"])
        self.assertEqual(len(result["steps"]), len(d["actions"]))
        prev = result["initial"]
        for i, step in enumerate(result["steps"]):
            if not step["accepted"]:
                self.assertEqual(step["state"], prev, "rejected step %d changed state" % i)
                self.assertIsInstance(step["error"], str)
            else:
                self.assertIsNone(step["error"])
            prev = step["state"]
        return result

    def expect(self, result, accepted):
        got = [s["accepted"] for s in result["steps"]]
        self.assertEqual(got, accepted, [s["error"] for s in result["steps"]])

    def err(self, result, i):
        return result["steps"][i]["error"]

    def st(self, result, i):
        return result["steps"][i]["state"]


class SetupAndTurns(Base):
    def test_initial_state(self):
        r = self.play(duel(101, "cowboy", ids("sheriff", 8), ids("skeleton", 8), []))
        s = r["initial"]
        self.assertEqual(r["seed"], 101)
        self.assertEqual((s["turn"], s["active"], s["first"]), (1, "cowboy", "cowboy"))
        self.assertFalse(s["over"])
        self.assertIsNone(s["winner"])
        self.assertIsNone(s["location"])
        self.assertEqual(s["allowances"], {"troop": True, "other": True, "trap": True, "cards": True})
        c, w = s["players"]["cowboy"], s["players"]["wizard"]
        self.assertEqual(c["hand"], ids("sheriff", 4))
        self.assertEqual(c["deck"], ids("sheriff", 4, 5))
        self.assertEqual(w["hand"], ids("skeleton", 5))      # second side draws 1 more
        self.assertEqual(w["deck"], ids("skeleton", 3, 6))
        for p in (c, w):
            self.assertEqual(p["base"], 5)
            self.assertEqual(p["troops"], [None, None, None])
            self.assertEqual(p["traps"], [None, None])
            self.assertEqual(p["discard"], [])

    def test_first_player_skips_turn_one_draw_second_draws(self):
        r = self.play(duel(102, "wizard", ids("sheriff", 8), ids("skeleton", 8), [END]))
        s = r["initial"]
        self.assertEqual(len(s["players"]["wizard"]["hand"]), 4)
        s1 = self.st(r, 0)
        self.assertEqual((s1["turn"], s1["active"]), (2, "cowboy"))
        self.assertEqual(s1["players"]["cowboy"]["hand"], ids("sheriff", 6))

    def test_free_troop_rests_turn_one_and_play_limits(self):
        r = self.play(duel(103, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [
            summon("sheriff-1"),
            attack(0, "base"),
            summon("sheriff-2"),
            cover(0),
            summon("sheriff-2"),
            summon("sheriff-9"),
        ]))
        self.expect(r, [True, False, False, True, False, False])
        t = self.st(r, 0)["players"]["cowboy"]["troops"][0]
        self.assertEqual((t["id"], t["card"], t["attack"], t["orbs"], t["rest"]),
                         ("sheriff-1", "Sheriff", 1, 3, True))
        self.assertEqual(self.err(r, 1), "no-attacks-on-turn-1")
        self.assertEqual(self.err(r, 2), "troop-already-played")
        s3 = self.st(r, 3)
        self.assertEqual(s3["players"]["cowboy"]["troops"][0]["statuses"], ["cover"])
        self.assertFalse(s3["allowances"]["cards"])
        self.assertEqual(self.err(r, 4), "cards-locked")
        self.assertEqual(self.err(r, 5), "card-not-in-hand")

    def test_quickdraw_still_cannot_attack_on_turn_one(self):
        r = self.play(duel(104, "wizard", ids("sheriff", 8), ["imp-1"] + ids("skeleton", 7), [
            summon("imp-1"), attack(0, "base")]))
        self.expect(r, [True, False])
        self.assertFalse(self.st(r, 0)["players"]["wizard"]["troops"][0]["rest"])
        self.assertEqual(self.err(r, 1), "no-attacks-on-turn-1")

    def test_hand_limit_discards_draw(self):
        # Wizard holds 5, draws to 6 on turn 2, and the turn-4 draw is discarded.
        r = self.play(duel(105, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [END, END, END]))
        w = self.st(r, 2)["players"]["wizard"]
        self.assertEqual(w["hand"], ids("skeleton", 6))
        self.assertEqual(w["discard"], ["skeleton-7"])
        self.assertEqual(w["deck"], ["skeleton-8"])


class Summoning(Base):
    def test_tribute_raise_and_tribute_attack(self):
        wiz = ["skeleton-1", "wizard-1", "skeleton-2", "skeleton-3", "skeleton-4", "skeleton-5"]
        r = self.play(duel(201, "wizard", ids("sheriff", 8), wiz, [
            summon("wizard-1"),            # 0 needs one tribute
            summon("skeleton-1"),          # 1
            END,                           # 2 -> turn 2 cowboy
            END,                           # 3 -> turn 3 wizard, draws skeleton-4
            summon("wizard-1", [1]),       # 4 slot 1 is empty
            summon("wizard-1", [0]),       # 5
            attack(1, "base"),             # 6 raised skeleton rests
            attack(0, "base"),             # 7 tribute-paid wizard can attack
            summon("skeleton-2"),          # 8 cards locked after acting
            cover(1),                      # 9 resting troop can take cover
            attack(0, "base"),             # 10 already acted
        ]))
        self.expect(r, [False, True, True, True, False, True, False, True, False, True, False])
        self.assertEqual(self.err(r, 0), "wrong-tribute-count")
        self.assertEqual(self.err(r, 4), "tribute-slot-empty")
        s5 = self.st(r, 5)["players"]["wizard"]
        self.assertEqual(s5["troops"][0]["id"], "wizard-1")
        self.assertFalse(s5["troops"][0]["rest"])
        self.assertEqual((s5["troops"][1]["id"], s5["troops"][1]["orbs"], s5["troops"][1]["rest"]),
                         ("skeleton-1", 1, True))
        self.assertEqual(s5["discard"], [])
        self.assertEqual(s5["hand"], ["skeleton-2", "skeleton-3", "skeleton-4"])
        self.assertEqual(s5["deck"], ["skeleton-5"])
        self.assertEqual(self.err(r, 6), "troop-resting")
        self.assertEqual(self.st(r, 7)["players"]["cowboy"]["base"], 3)
        self.assertEqual(self.err(r, 8), "cards-locked")
        self.assertEqual(self.err(r, 10), "troop-already-acted")

    def test_tribute_takes_gear_and_raise_returns_without_it(self):
        wiz = ["skeleton-1", "bone-armor-1", "wizard-1", "skeleton-2"] + ids("skeleton", 4, 3)
        r = self.play(duel(202, "wizard", ids("sheriff", 8), wiz, [
            summon("skeleton-1"), gear("bone-armor-1", 0), END, END, summon("wizard-1", [0])]))
        self.expect(r, [True, True, True, True, True])
        self.assertEqual(self.st(r, 1)["players"]["wizard"]["troops"][0]["orbs"], 5)
        w = self.st(r, 4)["players"]["wizard"]
        self.assertEqual(w["troops"][1]["id"], "skeleton-1")
        self.assertEqual(w["troops"][1]["orbs"], 1)
        self.assertEqual(w["troops"][1]["gear"], [])
        self.assertEqual(w["discard"], ["bone-armor-1"])

    def test_malformed_tributes_rejected(self):
        r = self.play(duel(203, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [
            {"type": "summon", "cardId": "sheriff-1", "tributes": "0"},
            {"type": "summon", "cardId": "sheriff-1", "tributes": [True]},
            summon("sheriff-1", [0]),
        ]))
        self.expect(r, [False, False, False])
        self.assertEqual(self.err(r, 0), "malformed-action")
        self.assertEqual(self.err(r, 1), "malformed-action")
        self.assertEqual(self.err(r, 2), "tribute-slot-empty")


class Fighting(Base):
    def test_hit_back_and_base_protected(self):
        r = self.play(duel(301, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [
            summon("sheriff-1"), END, summon("skeleton-1"), END,
            attack(0, "base"), attack(0, 0)]))
        self.expect(r, [True, True, True, True, False, True])
        self.assertEqual(self.err(r, 4), "base-protected")
        s = self.st(r, 5)
        self.assertEqual(s["players"]["wizard"]["troops"][0]["orbs"], 2)
        self.assertEqual(s["players"]["cowboy"]["troops"][0]["orbs"], 2)
        self.assertEqual((s["players"]["cowboy"]["base"], s["players"]["wizard"]["base"]), (5, 5))

    def test_overflow_cover_scout_and_deck_out(self):
        cow = ["dynamiter-1"] + ids("sheriff", 7)
        wiz = ["raven-familiar-1", "raven-familiar-2"] + ids("skeleton", 6)
        r = self.play(duel(302, "cowboy", cow, wiz, [
            summon("dynamiter-1"),        # 0 turn 1
            END,                          # 1 turn 2 wizard draws skeleton-4 (hand 6)
            summon("raven-familiar-1"),   # 2 Scout draws skeleton-5 (hand back to 6)
            END,                          # 3 turn 3
            attack(0, 0),                 # 4 3 attack into 1 orb: 2 overflow
            END,                          # 5 turn 4: hand 6, skeleton-6 discarded
            summon("raven-familiar-2"),   # 6 Scout with empty deck: nothing, no orb lost
            cover(0),                     # 7
            END,                          # 8 turn 5
            attack(0, 0),                 # 9 defeated in cover: overflow blocked
            END,                          # 10 turn 6: wizard deck empty, base -1
        ]))
        self.expect(r, [True] * 11)
        w2 = self.st(r, 2)["players"]["wizard"]
        self.assertEqual(w2["hand"], ["raven-familiar-2", "skeleton-1", "skeleton-2",
                                      "skeleton-3", "skeleton-4", "skeleton-5"])
        s4 = self.st(r, 4)
        self.assertEqual(s4["players"]["wizard"]["base"], 3)
        self.assertEqual(s4["players"]["wizard"]["discard"], ["raven-familiar-1"])
        self.assertEqual(s4["players"]["cowboy"]["troops"][0]["orbs"], 1)
        self.assertEqual(self.st(r, 5)["players"]["wizard"]["discard"],
                         ["raven-familiar-1", "skeleton-6"])
        self.assertEqual(self.st(r, 6)["players"]["wizard"]["base"], 3)
        s8 = self.st(r, 8)
        self.assertEqual(s8["players"]["wizard"]["troops"][0]["statuses"], ["cover"])
        s9 = self.st(r, 9)
        self.assertEqual(s9["players"]["wizard"]["base"], 3)
        self.assertEqual(s9["players"]["wizard"]["troops"], [None, None, None])
        self.assertEqual(self.st(r, 10)["players"]["wizard"]["base"], 2)

    def test_last_stand_when_defending(self):
        cow = ["dynamiter-1"] + ids("sheriff", 7)
        r = self.play(duel(303, "cowboy", cow, ids("skeleton", 8), [
            summon("dynamiter-1"), END, summon("skeleton-1"), END, END, attack(0, 0)]))
        self.expect(r, [True] * 6)
        s = self.st(r, 5)
        self.assertEqual(s["players"]["cowboy"]["troops"], [None, None, None])
        self.assertEqual(s["players"]["cowboy"]["discard"], ["dynamiter-1"])
        self.assertEqual(s["players"]["cowboy"]["base"], 5)
        self.assertEqual(s["players"]["wizard"]["troops"][0]["orbs"], 2)

    def test_last_stand_when_attacking_and_location_attack(self):
        wiz = ["bone-wall-1", "boneyard-1"] + ids("skeleton", 6)
        cow = ["dynamiter-1"] + ids("sheriff", 7)
        r = self.play(duel(304, "wizard", cow, wiz, [
            summon("bone-wall-1"), location("boneyard-1"), END,
            summon("dynamiter-1"), END, END, attack(0, 0)]))
        self.expect(r, [True] * 7)
        self.assertEqual(self.st(r, 1)["players"]["wizard"]["troops"][0]["attack"], 1)
        s = self.st(r, 6)
        # Wall 4 -> 1, hits back 1 and defeats Dynamiter, whose Last Stand defeats the wall.
        self.assertEqual(s["players"]["cowboy"]["discard"], ["dynamiter-1"])
        self.assertEqual(s["players"]["wizard"]["discard"], ["bone-wall-1"])
        self.assertEqual(s["players"]["wizard"]["troops"], [None, None, None])
        self.assertEqual(s["location"], {"id": "boneyard-1", "card": "Boneyard", "owner": "wizard"})
        self.assertEqual((s["players"]["cowboy"]["base"], s["players"]["wizard"]["base"]), (5, 5))

    def test_guard_and_ride(self):
        cow = ["outrider-1"] + ids("sheriff", 7)
        wiz = ["skeleton-1", "bone-wall-1"] + ids("skeleton", 6, 2)
        r = self.play(duel(305, "cowboy", cow, wiz, [
            summon("outrider-1"), END, summon("skeleton-1"), END,
            attack(0, "base"),       # 4 ride past for 1
            END, summon("bone-wall-1"), END,
            attack(0, "base"),       # 8 guard blocks ride
            attack(0, 0),            # 9 must attack guard
            attack(0, 1),            # 10
        ]))
        self.expect(r, [True] * 8 + [False, False, True])
        self.assertEqual(self.st(r, 4)["players"]["wizard"]["base"], 4)
        self.assertEqual(self.err(r, 8), "guard-blocks-ride")
        self.assertEqual(self.err(r, 9), "must-attack-guard")
        s = self.st(r, 10)
        self.assertEqual(s["players"]["wizard"]["troops"][1]["orbs"], 3)
        self.assertEqual(s["players"]["cowboy"]["troops"][0]["orbs"], 3)

    def test_sweep(self):
        cow = ["sheriff-1", "captured-dragon-1"] + ids("sheriff", 5, 2)
        r = self.play(duel(306, "cowboy", cow, ids("skeleton", 8), [
            summon("sheriff-1"), END, summon("skeleton-1"), END, END, summon("skeleton-2"), END,
            summon("captured-dragon-1", [0]), attack(0, 0)]))
        self.expect(r, [True] * 9)
        s7 = self.st(r, 7)["players"]["cowboy"]
        self.assertEqual(s7["discard"], ["sheriff-1"])
        self.assertFalse(s7["troops"][0]["rest"])
        s = self.st(r, 8)
        w = s["players"]["wizard"]
        self.assertEqual(w["base"], 4)                  # 4 attack into 3 orbs
        self.assertIsNone(w["troops"][0])
        self.assertEqual(w["troops"][1]["orbs"], 2)     # swept
        self.assertEqual(s["players"]["cowboy"]["troops"][0]["orbs"], 2)


class TrapsSpellsGear(Base):
    def test_bear_trap_and_hex(self):
        cow = ["bear-trap-1"] + ids("sheriff", 7)
        wiz = ["imp-1", "hex-1"] + ids("skeleton", 6)
        r = self.play(duel(401, "cowboy", cow, wiz, [
            set_trap("bear-trap-1"),   # 0
            END,                       # 1 turn 2
            set_trap("hex-1"),         # 2
            summon("imp-1"),           # 3 quickdraw
            attack(0, "base"),         # 4 bear trap defeats imp
            summon("skeleton-1"),      # 5 cards locked
            END, summon("sheriff-1"), END, END,
            attack(0, "base"),         # 10 hex cancels
        ]))
        self.expect(r, [True] * 5 + [False] + [True] * 5)
        self.assertEqual(self.st(r, 0)["players"]["cowboy"]["traps"],
                         [{"id": "bear-trap-1", "card": "Bear Trap", "setTurn": 1}, None])
        s4 = self.st(r, 4)
        self.assertEqual(s4["players"]["cowboy"]["base"], 5)
        self.assertEqual(s4["players"]["cowboy"]["traps"], [None, None])
        self.assertEqual(s4["players"]["cowboy"]["discard"], ["bear-trap-1"])
        self.assertEqual(s4["players"]["wizard"]["discard"], ["imp-1"])
        self.assertEqual(s4["players"]["wizard"]["troops"], [None, None, None])
        s10 = self.st(r, 10)
        self.assertEqual(s10["players"]["wizard"]["base"], 5)
        self.assertEqual(s10["players"]["wizard"]["discard"], ["imp-1", "hex-1"])
        self.assertTrue(s10["players"]["cowboy"]["troops"][0]["acted"])

    def test_oldest_trap_springs_first(self):
        wiz = ["hex-1", "bear-trap-1", "hex-2"] + ids("skeleton", 5)
        r = self.play(duel(402, "wizard", ids("sheriff", 8), wiz, [
            set_trap("hex-1"), END,
            summon("sheriff-1"), END,
            set_trap("bear-trap-1"), set_trap("hex-2"), END,
            attack(0, "base"),        # 7 hex (turn 1) springs
            END,
            set_trap("hex-2"), END,   # hex-2 fills slot 0 on turn 5
            attack(0, "base"),        # 11 bear trap (turn 3) springs, sheriff survives
        ]))
        self.expect(r, [True] * 5 + [False] + [True] * 6)
        self.assertEqual(self.err(r, 5), "trap-already-set")
        s7 = self.st(r, 7)
        self.assertEqual(s7["players"]["wizard"]["traps"],
                         [None, {"id": "bear-trap-1", "card": "Bear Trap", "setTurn": 3}])
        self.assertEqual(s7["players"]["wizard"]["base"], 5)
        s11 = self.st(r, 11)
        self.assertEqual(s11["players"]["wizard"]["traps"],
                         [{"id": "hex-2", "card": "Hex", "setTurn": 5}, None])
        self.assertEqual(s11["players"]["cowboy"]["troops"][0]["orbs"], 1)
        self.assertEqual(s11["players"]["wizard"]["base"], 4)

    def test_spells_ghostly_hellfire_lasso(self):
        cow = ["captured-wraith-1", "sheriff-1", "lasso-1", "sheriff-2"] + ids("sheriff", 4, 3)
        wiz = ["singularity-1", "hellfire-1"] + ids("skeleton", 6)
        r = self.play(duel(403, "cowboy", cow, wiz, [
            summon("captured-wraith-1"), END,      # 0, 1
            spell("singularity-1", 0),             # 2 ghostly
            spell("singularity-1"),                # 3 no target
            spell("hellfire-1", 0),                # 4 hellfire takes no target
            spell("hellfire-1"),                   # 5 burns the ghostly wraith
            spell("singularity-1", 0),             # 6 one other card per turn
            summon("skeleton-1"), END,             # 7, 8
            spell("lasso-1", 0),                   # 9
            END,                                   # 10 turn 4 wizard
            attack(0, 0),                          # 11 stunned
            cover(0),                              # 12 stunned troop may take cover
            END,                                   # 13 stun recovers at end of owner's turn
        ]))
        self.expect(r, [True, True, False, False, False, True, False, True, True, True, True,
                        False, True, True])
        self.assertEqual(self.err(r, 2), "target-ghostly")
        self.assertEqual(self.err(r, 3), "target-required")
        self.assertEqual(self.err(r, 4), "spell-takes-no-target")
        s5 = self.st(r, 5)
        self.assertEqual(s5["players"]["cowboy"]["troops"][0]["orbs"], 1)
        self.assertEqual(s5["players"]["wizard"]["discard"], ["hellfire-1"])
        self.assertEqual(self.err(r, 6), "other-card-already-played")
        self.assertEqual(self.st(r, 9)["players"]["wizard"]["troops"][0]["statuses"], ["stunned"])
        self.assertEqual(self.st(r, 9)["players"]["cowboy"]["discard"], ["lasso-1"])
        self.assertEqual(self.err(r, 11), "troop-stunned")
        self.assertEqual(self.st(r, 12)["players"]["wizard"]["troops"][0]["statuses"],
                         ["cover", "stunned"])
        s13 = self.st(r, 13)
        self.assertEqual(s13["active"], "cowboy")
        self.assertEqual(s13["players"]["wizard"]["troops"][0]["statuses"], ["cover"])

    def test_gear_and_locations(self):
        wiz = ["skeleton-1", "bone-armor-1", "boneyard-1", "boneyard-2"] + ids("skeleton", 4, 2)
        cow = ["sheriff-1", "sheriffs-office-1", "six-shooter-1"] + ids("sheriff", 5, 2)
        r = self.play(duel(404, "wizard", cow, wiz, [
            gear("bone-armor-1", 0),          # 0 empty slot
            summon("skeleton-1"),             # 1
            gear("bone-armor-1", 0),          # 2 orbs 5
            location("boneyard-1"),           # 3 other card used
            END,                              # 4 turn 2
            summon("sheriff-1"),              # 5
            location("sheriffs-office-1"),    # 6
            END,                              # 7 turn 3
            location("boneyard-1"),           # 8 replaces office
            END,                              # 9 turn 4
            gear("six-shooter-1", 0),         # 10
            END,                              # 11 turn 5
            location("boneyard-2"),           # 12 same name
        ]))
        self.expect(r, [False, True, True, False, True, True, True, True, True, True, True,
                        True, False])
        self.assertEqual(self.err(r, 0), "gear-slot-empty")
        self.assertEqual(self.st(r, 2)["players"]["wizard"]["troops"][0]["orbs"], 5)
        self.assertEqual(self.st(r, 2)["players"]["wizard"]["troops"][0]["gear"], ["bone-armor-1"])
        s6 = self.st(r, 6)
        self.assertEqual(s6["players"]["cowboy"]["troops"][0]["attack"], 2)
        self.assertEqual(s6["location"]["owner"], "cowboy")
        s8 = self.st(r, 8)
        self.assertEqual(s8["players"]["cowboy"]["discard"], ["sheriffs-office-1"])
        self.assertEqual(s8["players"]["cowboy"]["troops"][0]["attack"], 1)
        self.assertEqual(s8["players"]["wizard"]["troops"][0]["attack"], 2)
        self.assertEqual(s8["location"], {"id": "boneyard-1", "card": "Boneyard", "owner": "wizard"})
        self.assertEqual(self.st(r, 10)["players"]["cowboy"]["troops"][0]["attack"], 2)
        self.assertEqual(self.err(r, 12), "same-location-in-play")


class Terminal(Base):
    def test_deck_out_ends_game(self):
        r = self.play(duel(501, "cowboy", ids("sheriff", 4), ids("skeleton", 5), [END] * 10))
        self.expect(r, [True] * 9 + [False])
        bases = [(s["state"]["players"]["cowboy"]["base"], s["state"]["players"]["wizard"]["base"])
                 for s in r["steps"][:9]]
        self.assertEqual(bases, [(5, 4), (4, 4), (4, 3), (3, 3), (3, 2), (2, 2), (2, 1), (1, 1), (1, 0)])
        s = self.st(r, 8)
        self.assertEqual((s["over"], s["winner"], s["reason"], s["turn"]),
                         (True, "cowboy", "base-destroyed", 10))
        self.assertEqual(self.err(r, 9), "game-over")

    def test_attacks_end_game(self):
        cow = ["dynamiter-1", "dynamiter-2"] + ids("sheriff", 6)
        r = self.play(duel(502, "cowboy", cow, ids("skeleton", 8), [
            summon("dynamiter-1"), END, END, attack(0, "base"), END, END, attack(0, "base"), END]))
        self.expect(r, [True] * 7 + [False])
        self.assertEqual(self.st(r, 3)["players"]["wizard"]["base"], 2)
        s = self.st(r, 6)
        self.assertEqual(s["players"]["wizard"]["base"], 0)
        self.assertEqual((s["over"], s["winner"], s["reason"]), (True, "cowboy", "base-destroyed"))
        self.assertEqual(self.err(r, 7), "game-over")

    def test_turn_limit(self):
        with mock.patch.object(R, "TURN_LIMIT", 3):
            r = self.play(duel(503, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [
                summon("sheriff-1"), END, END, attack(0, "base"), END, END]))
            self.expect(r, [True] * 5 + [False])
            s = self.st(r, 4)
            self.assertEqual((s["over"], s["winner"], s["reason"], s["turn"]),
                             (True, "cowboy", "turn-limit", 3))
            r2 = self.play(duel(504, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [END, END, END]))
            s2 = self.st(r2, 2)
            self.assertEqual((s2["over"], s2["winner"], s2["reason"]), (True, None, "turn-limit-draw"))


class Boundary(Base):
    def test_card_id_decoding(self):
        self.assertEqual(R.resolve_card_name("sheriffs-office-1"), "Sheriff's Office")
        self.assertEqual(R.resolve_card_name("sheriff-s-office-2"), "Sheriff's Office")
        self.assertEqual(R.resolve_card_name("jack-o-lantern-3"), "Jack-o'-Lantern")
        self.assertEqual(R.resolve_card_name("six-shooter-1"), "Six-Shooter")
        self.assertEqual(R.resolve_card_name("wizard-12"), "Wizard")
        self.assertEqual(R.resolve_card_name("c7", {"c7": "Imp"}), "Imp")
        self.assertEqual(R.resolve_card_name("lawdog-1", {"lawdog": "Sheriff"}), "Sheriff")
        for bad in ("sheriff", "Sheriff-1", "ghost-1"):
            with self.assertRaises(R.InvalidDuel):
                R.resolve_card_name(bad)

    def test_invalid_duels(self):
        good = duel(601, "cowboy", ids("sheriff", 4), ids("skeleton", 4), [])
        bad_first = dict(good, first="bandit")
        bad_card = dict(good, decks={"cowboy": ["unicorn-1"], "wizard": []})
        dup = dict(good, decks={"cowboy": ["sheriff-1", "sheriff-1"], "wizard": []})
        for d in (bad_first, bad_card, dup, "not a duel"):
            out = R.run_duel(d)
            self.assertIsNone(out["initial"])
            self.assertEqual(out["steps"], [])
            self.assertTrue(out["unsupported"][0].startswith("invalid-duel"))

    def test_unknown_and_malformed_actions(self):
        r = self.play(duel(602, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [
            {"type": "dance"}, {"cardId": "sheriff-1"}, "end", {"type": "attack", "slot": 0},
            {"type": "attack", "slot": 3, "target": "base"}, {"type": "cover", "slot": 0}]))
        self.expect(r, [False] * 6)
        self.assertEqual(self.err(r, 0), "unsupported-action-type:dance")
        self.assertEqual(r["unsupported"], ["step 0: unsupported-action-type:dance"])
        self.assertEqual(self.err(r, 1), "malformed-action")
        self.assertEqual(self.err(r, 2), "malformed-action")
        self.assertEqual(self.err(r, 3), "troop-slot-empty")
        self.assertEqual(self.err(r, 4), "slot-out-of-range")
        self.assertEqual(self.err(r, 5), "troop-slot-empty")

    def test_stream_function(self):
        lines = [json.dumps(duel(701, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [END])),
                 "", "{not json", json.dumps(duel(702, "wizard", ids("sheriff", 8), ids("skeleton", 8), []))]
        out = io.StringIO()
        R.stream(io.StringIO("\n".join(lines) + "\n"), out)
        results = [json.loads(x) for x in out.getvalue().splitlines()]
        self.assertEqual([x["seed"] for x in results], [701, None, 702])
        self.assertEqual(set(results[0]), {"seed", "initial", "steps", "unsupported"})
        self.assertTrue(results[1]["unsupported"][0].startswith("invalid-duel: malformed JSON"))

    def test_cli_stream(self):
        line = json.dumps(duel(703, "cowboy", ids("sheriff", 8), ids("skeleton", 8), [END]))
        proc = subprocess.run([sys.executable, os.path.join(HERE, "referee.py"), "--stream"],
                              input=line + "\n", capture_output=True, text=True, timeout=60)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        out = json.loads(proc.stdout.strip())
        self.assertEqual(out["seed"], 703)
        self.assertEqual(out["steps"][0]["state"]["turn"], 2)

    @unittest.skipUnless(os.path.exists(R.DEFAULT_CSV), "rules/cards.csv not present")
    def test_catalog_matches_csv(self):
        self.assertEqual(R.check_catalog(R.DEFAULT_CSV), [])


if __name__ == "__main__":
    unittest.main()
