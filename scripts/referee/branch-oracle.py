#!/usr/bin/env python3
"""Branch oracle: ask the frozen Showdown referee about many candidate actions per position.

Driven by scripts/referee/legal-branches.mjs. This file adjudicates nothing itself. It loads
proof/referee/referee.py read-only (no bytecode is written next to it) and, for every candidate,
calls the referee's own Duel.apply on a deep copy of the referee's own state, which is exactly what
Duel.run does for each input action. It reports the referee's verdict and a SHA-256 digest of the
referee's own normalized state (Duel.normalize). The main line is stepped the same way and then
checked against a fresh Duel(...).run() of the same input.

Usage: python3 scripts/referee/branch-oracle.py proof/referee/referee.py < requests > responses

stdin, one JSON request per line:
  {"id": n, "duel": {seed, first, decks, actions, cardNames?},
   "probe": [[k, [action, ...]], ...],   k = how many duel actions have been applied (0 = setup)
   "full": [[k, j], ...]}                 optional: also return the full state for candidate j at k
stdout, one JSON response per request, in order:
  {"id": n, "seed": s, "main": [digest after setup, digest after action 1, ...],
   "mainAccepted": [bool per action], "runAgrees": bool,
   "verdicts": [[k, [[accepted, error, digest], ...]], ...], "full": [[k, j, state], ...],
   "error": null}
accepted is true, false, or null when the referee raised something other than its Illegal
rejection; error then says what was raised. Digests hash the canonical JSON text: keys sorted,
no spaces, UTF-8.
"""

import copy
import hashlib
import importlib.util
import json
import sys


def load_referee(path):
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("frozen_showdown_referee", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def verdict(ref, duel, state, action):
    trial = copy.deepcopy(state)
    try:
        duel.apply(trial, action)
    except ref.Illegal as exc:
        return [False, exc.code, None], None
    except Exception as exc:  # an oracle crash is reported, never hidden
        return [None, "crash: %s: %s" % (type(exc).__name__, str(exc)[:200]), None], None
    view = duel.normalize(trial)
    return [True, None, digest(view)], view


def answer(ref, request):
    duel_input = request["duel"]
    probes = {k: actions for k, actions in request.get("probe", [])}
    wanted = {}
    for k, j in request.get("full", []):
        wanted.setdefault(k, set()).add(j)
    duel = ref.Duel(duel_input)
    main = [digest(duel.normalize(duel.state))]
    accepted = []
    verdicts = []
    full = []

    def probe(k):
        if k not in probes:
            return
        row = []
        for j, action in enumerate(probes[k]):
            result, view = verdict(ref, duel, duel.state, action)
            row.append(result)
            if j in wanted.get(k, ()):
                full.append([k, j, view])
        verdicts.append([k, row])

    probe(0)
    for index, action in enumerate(duel.actions):
        # The body of Duel.run for one input action.
        trial = copy.deepcopy(duel.state)
        try:
            duel.apply(trial, action)
        except ref.Illegal:
            accepted.append(False)
        else:
            duel.state = trial
            accepted.append(True)
        main.append(digest(duel.normalize(duel.state)))
        probe(index + 1)

    run = ref.Duel(duel_input).run()
    run_main = [digest(run["initial"])] + [digest(step["state"]) for step in run["steps"]]
    run_accepted = [step["accepted"] for step in run["steps"]]
    return {
        "id": request["id"], "seed": duel_input.get("seed"), "main": main, "mainAccepted": accepted,
        "runAgrees": run_main == main and run_accepted == accepted,
        "verdicts": verdicts, "full": full, "error": None,
    }


def main(argv):
    if len(argv) != 2:
        sys.stderr.write("usage: python3 scripts/referee/branch-oracle.py path/to/referee.py\n")
        return 2
    ref = load_referee(argv[1])
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        try:
            response = answer(ref, request)
        except Exception as exc:
            response = {"id": request.get("id"), "error": "%s: %s" % (type(exc).__name__, exc)}
        sys.stdout.write(json.dumps(response, separators=(",", ":"), ensure_ascii=False) + "\n")
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
