"""Fast, dependency-free checks for the optional Night Watch Crew extension."""
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import balance
import server


class NightWatchTests(unittest.TestCase):
    def test_config_rejects_unsafe_ranges_and_boolean_counts(self):
        repo = str(Path(__file__).resolve().parents[3])
        for values in (
            {"count": 0},
            {"count": 10001},
            {"count": True},
            {"threshold": float("nan")},
            {"firstSeed": -1},
            {"firstSeed": 2**32 - 1, "count": 2},
            {"baseline": "HEAD\nother"},
        ):
            with self.subTest(values=values):
                with self.assertRaises(balance.ConfigError):
                    balance.validate_config({"repo": repo, **values})

    def test_same_seed_threshold_alerts_and_seat_growth(self):
        config = {"count": 1000, "threshold": 10}
        baseline = {"cowboy": 500, "wizard": 400, "first": 570, "second": 330}
        candidate = {"cowboy": 600, "wizard": 350, "first": 650, "second": 300}
        status, detail = balance.judge(config, baseline, candidate)
        self.assertEqual(status, "alert")
        self.assertIn("Cowboy win share rose 10.0 pp.", detail)
        self.assertIn("First-seat advantage grew 11.0 pp.", detail)

    def test_small_variances_do_not_trigger_alert(self):
        config = {"count": 1000, "threshold": 10}
        baseline = {"cowboy": 500, "wizard": 400, "first": 530, "second": 470}
        candidate = {"cowboy": 540, "wizard": 370, "first": 550, "second": 450}
        status, detail = balance.judge(config, baseline, candidate)
        self.assertEqual(status, "steady")
        self.assertIn("within", detail)

    def test_isolated_state_store_round_trip(self):
        with tempfile.TemporaryDirectory(prefix="night-watch-unit-") as directory:
            with patch.dict(os.environ, {"NIGHT_WATCH_DATA_DIR": directory}):
                self.assertEqual(server.load_reports(), [])
                self.assertEqual(server.load_config()["count"], 1000)
                report = {"id": "test-only", "state": "steady"}
                server.write_json("history.json", [report])
                self.assertEqual(server.load_reports(), [report])
                self.assertTrue((Path(directory) / "history.json").is_file())

    def assert_extracted_fixture_runs(self, files):
        with tempfile.TemporaryDirectory(prefix="night-watch-fixture-") as directory:
            repo = os.path.join(directory, "repo")
            for name, body in files.items():
                path = os.path.join(repo, name)
                os.makedirs(os.path.dirname(path), exist_ok=True)
                Path(path).write_text(body)
            git = ["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com"]
            subprocess.run(["git", "init", "-q", repo], check=True)
            subprocess.run(git + ["add", "-A"], check=True)
            subprocess.run(git + ["commit", "-q", "-m", "fixture"], check=True)
            commit = subprocess.run(git + ["rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
            snapshot = os.path.join(directory, "snapshot")
            balance.extract_snapshot(repo, commit, snapshot)
            state, count = balance.run_game_tests(snapshot, balance.node_command())
            self.assertEqual((state, count), ("passed", 1))

    @unittest.skipUnless(shutil.which("node") and shutil.which("git"), "needs node and git")
    def test_extracted_snapshot_runs_game_test_that_imports_profile_module(self):
        self.assert_extracted_fixture_runs({
            "package.json": '{"type": "module"}',
            "src/game/engine.js": "export const turn = 1;\n",
            "src/profile/player-profile.js": "export const profile = 'ok';\n",
            "scripts/play-match.mjs": "",
            "scripts/simulate-matches.mjs": "",
            "tests/game/player-profile.test.js": (
                "import test from 'node:test';\nimport assert from 'node:assert';\n"
                "import { profile } from '../../src/profile/player-profile.js';\n"
                "test('profile', () => assert.equal(profile, 'ok'));\n"
            ),
        })

    @unittest.skipUnless(shutil.which("node") and shutil.which("git"), "needs node and git")
    def test_extracted_legacy_snapshot_without_profile_runs_game_test(self):
        self.assert_extracted_fixture_runs({
            "package.json": '{"type": "module"}',
            "src/game/engine.js": "export const turn = 1;\n",
            "scripts/play-match.mjs": "",
            "scripts/simulate-matches.mjs": "",
            "tests/game/engine.test.js": (
                "import test from 'node:test';\nimport assert from 'node:assert';\n"
                "import { turn } from '../../src/game/engine.js';\n"
                "test('legacy engine', () => assert.equal(turn, 1));\n"
            ),
        })


class ShowdownModeTests(unittest.TestCase):
    """Showdown mode: each deal played twice with the first seat swapped (prototypes/showdown/sim.mjs)."""

    def test_config_accepts_only_known_modes_and_keeps_lanes_default(self):
        repo = str(Path(__file__).resolve().parents[3])
        self.assertEqual(balance.DEFAULT_CONFIG["mode"], "lanes")
        self.assertEqual(balance.validate_config({"repo": repo, "mode": "showdown"})["mode"], "showdown")
        with self.assertRaises(balance.ConfigError):
            balance.validate_config({"repo": repo, "mode": "trail"})

    def test_parse_requires_both_seats_for_every_deal(self):
        config = {"firstSeed": 0, "count": 2, "mode": "showdown"}
        good = {"mode": "showdown", "seeds": {"from": 0, "to": 1, "deals": 2},
                "games": 4, "cowboy": 3, "wizard": 1, "draw": 0, "first": 2, "second": 2}
        self.assertEqual(balance.parse_showdown(good, config)["games"], 4)
        for change in ({"games": 2, "cowboy": 1, "wizard": 1}, {"first": 3}, {"seeds": {"from": 1, "to": 2, "deals": 2}}):
            with self.subTest(change=change):
                with self.assertRaises(balance.CheckError):
                    balance.parse_showdown({**good, **change}, config)

    def test_judge_divides_showdown_shifts_by_games_not_deals(self):
        config = {"count": 1000, "threshold": 10}
        base = {"games": 2000, "cowboy": 1186, "wizard": 814, "draw": 0, "first": 1150, "second": 850}
        # +150 Cowboy wins is 7.5 pp of 2,000 games (it would be 15 pp of 1,000 deals).
        cand = {**base, "cowboy": 1336, "wizard": 664}
        self.assertEqual(balance.judge(config, base, cand)[0], "steady")
        cand = {**base, "cowboy": 1386, "wizard": 614}
        status, detail = balance.judge(config, base, cand)
        self.assertEqual(status, "alert")
        self.assertIn("Cowboy win share rose 10.0 pp.", detail)

    def test_nightly_job_selects_showdown(self):
        calls = []
        with tempfile.TemporaryDirectory() as data, patch.dict(os.environ, {"NIGHT_WATCH_DATA_DIR": data}), \
                patch.object(server.shutil, "which", return_value="/usr/bin/kirocrew"), \
                patch.object(server, "load_config", return_value={"repo": "/tmp/x"}), \
                patch.object(server.subprocess, "run", side_effect=lambda argv: calls.append(argv) or subprocess.CompletedProcess(argv, 0)):
            self.assertEqual(server.main(["schedule", "--time", "02:00"]), 0)
        command = calls[0][calls[0].index("--command") + 1]
        self.assertTrue(command.endswith("run --scheduled --mode showdown"), command)

    @unittest.skipUnless(shutil.which("node") and shutil.which("git"), "needs node and git")
    def test_runner_plays_each_deal_from_both_seats_in_an_extracted_snapshot(self):
        rules = (
            "export function createShowdown(seed, {first}) { return {seed, first, turn: 0, result: null}; }\n"
            "export function playTurn(state) {\n"
            "  const winner = state.seed % 3 === 2 ? null : state.seed % 3 === 0 ? state.first : 'cowboy';\n"
            "  return {state: {...state, turn: 1, result: {winner, reason: 'base'}}, events: []};\n"
            "}\n"
        )
        with tempfile.TemporaryDirectory(prefix="night-watch-showdown-") as directory:
            repo = os.path.join(directory, "repo")
            for name, body in {"package.json": '{"type": "module"}', "src/game/engine.js": "",
                               "prototypes/showdown/rules.js": rules}.items():
                os.makedirs(os.path.dirname(os.path.join(repo, name)), exist_ok=True)
                Path(repo, name).write_text(body)
            git = ["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com"]
            subprocess.run(["git", "init", "-q", repo], check=True)
            subprocess.run(git + ["add", "-A"], check=True)
            subprocess.run(git + ["commit", "-q", "-m", "fixture"], check=True)
            commit = subprocess.run(git + ["rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
            snapshot = os.path.join(directory, "snapshot")
            balance.extract_snapshot(repo, commit, snapshot, "showdown")
            counts = balance.simulate(snapshot, balance.node_command(), {"firstSeed": 0, "count": 3, "mode": "showdown"})
        # Seed 0: the first seat wins both games. Seed 1: Cowboys win both. Seed 2: two draws.
        self.assertEqual(counts, {"games": 6, "cowboy": 3, "wizard": 1, "draw": 2, "first": 3, "second": 1})


class HostGuardTests(unittest.TestCase):
    def request(self, port, host, path="/health", extra=None):
        conn = HTTPConnection("127.0.0.1", port, timeout=5)
        conn.putrequest("GET", path, skip_host=True, skip_accept_encoding=True)
        if host is not None:
            conn.putheader("Host", host)
        for name, value in (extra or {}).items():
            conn.putheader(name, value)
        conn.endheaders()
        status = conn.getresponse().status
        conn.close()
        return status

    def test_host_guard_uses_actual_port(self):
        with tempfile.TemporaryDirectory() as data, patch.dict(os.environ, {"NIGHT_WATCH_DATA_DIR": data}):
            httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            try:
                port = httpd.server_address[1]
                for host in ("127.0.0.1:%d" % port, "localhost:%d" % port):
                    for path in ("/health", "/apps/" + server.APP_ID + "/api/health", "/api/state"):
                        with self.subTest(host=host, path=path):
                            self.assertEqual(self.request(port, host, path), 200)
                for host in ("evil.domain", "evil.domain:%d" % port, "127.0.0.1:%d" % (port + 1), "127.0.0.1", None):
                    with self.subTest(host=host):
                        self.assertEqual(self.request(port, host), 403)
                self.assertEqual(self.request(port, "evil.domain:%d" % port, extra={"X-Forwarded-Host": "localhost:%d" % port}), 403)
            finally:
                httpd.shutdown()
                httpd.server_close()


if __name__ == "__main__":
    unittest.main()
