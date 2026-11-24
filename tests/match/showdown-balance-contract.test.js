// Executable checks for the Night Shift balance contract
// (.kiro/specs/night-shift-balance-contract/requirements.md, parsed by scripts/showdown-balance-contract.mjs).
// The two normative lines NSB-1 and NSB-2 are parsed into the policy that decides a candidate, so editing
// their text must change decisions. Shares are percents. seatSkew is abs(openingPlayerSharePct - 50).
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {BalanceContractError, contractProblems, evaluateBalanceRequirements, loadBalanceContract, parseBalanceContract}
  from "../../scripts/showdown-balance-contract.mjs";
import {POLICY, decideAttempt} from "../../scripts/contest-balance.mjs";

const REQUIREMENTS = new URL("../../.kiro/specs/night-shift-balance-contract/requirements.md", import.meta.url);
const AUDIT = JSON.parse(readFileSync(new URL("../../docs/evidence/billy-seat-audit/result.json", import.meta.url), "utf8"));
const NSB1 = "- NSB-1: Each faction's win share SHALL be within 45% to 55%, inclusive.";
const NSB2 = "- NSB-2: The opening player's absolute win-share distance from 50% SHALL grow by at most 1 percentage point versus the baseline.";
const text = readFileSync(REQUIREMENTS, "utf8");

// Edits one exact normative line of the real requirements text; fails loudly if the line is absent.
const edit = (from, to, source = text) => {
  assert.ok(source.includes(from), `requirements text lacks: ${from}`);
  return source.replace(from, to);
};
const withBand = (low, high) => edit(NSB1, NSB1.replace("45% to 55%", `${low}% to ${high}%`));
const withSeatTolerance = (pp) => edit(NSB2, NSB2.replace("at most 1 percentage point", `at most ${pp} percentage point`));

// The reported candidate over all seats, from docs/evidence/billy-seat-audit/result.json: 25960 Cowboy wins
// of 50000 games (no draws), opening player 29068 (baseline opening player 29706). Computed the way
// contest-balance.mjs computes shares: 100 * wins / games.
const pct = (wins, games) => (100 * wins) / games;
const arms = AUDIT.byFirst;
const GAMES = arms.cowboy.gamesPerArm + arms.wizard.gamesPerArm;
const won = (arm, side) => arms.cowboy[arm][side] + arms.wizard[arm][side];
const opener = (arm) => arms.cowboy[arm].cowboy + arms.wizard[arm].wizard;
const CANDIDATE = Object.freeze({cowboyShare: pct(won("candidate", "cowboy"), GAMES), wizardShare: pct(won("candidate", "wizard"), GAMES),
  seatSkew: Math.abs(pct(opener("candidate"), GAMES) - 50), baselineSeatSkew: Math.abs(pct(opener("baseline"), GAMES) - 50)});
// Paired results that did not change, summed over both seat arms.
const SAME = ["cowboy", "wizard"].reduce((sum, first) => sum + ["cowboy", "wizard", "draw"].reduce((n, side) => n + arms[first].transitions[side][side], 0), 0);

const verdicts = (policy, observed) => evaluateBalanceRequirements(policy, observed).map(({id, pass}) => ({id, pass}));
const both = (nsb1, nsb2) => [{id: "NSB-1", pass: nsb1}, {id: "NSB-2", pass: nsb2}];
const contract = parseBalanceContract(text);

test("the requirements file states exactly the two agreed normative lines", () => {
  const lines = text.split(/\r?\n/);
  assert.equal(lines.filter((line) => line === NSB1).length, 1);
  assert.equal(lines.filter((line) => line === NSB2).length, 1);
});

test("the written contract yields the 45-55% band and 1 pp seat tolerance recorded in earlier receipts", () => {
  assert.deepEqual(contract.band, [45, 55]);
  assert.equal(contract.seatTolerancePp, 1);
  const loaded = loadBalanceContract();
  assert.deepEqual({band: loaded.band, seatTolerancePp: loaded.seatTolerancePp}, {band: [45, 55], seatTolerancePp: 1});
  assert.deepEqual(POLICY.band, loaded.band);
  assert.equal(POLICY.seatTolerancePp, loaded.seatTolerancePp);
});

test("the candidate figures match the reported audit counts", () => {
  assert.equal(AUDIT.firstSeed, 901010000);
  assert.equal(AUDIT.deals, 25000);
  assert.equal(GAMES, 50000);
  assert.equal(won("candidate", "cowboy"), 25960);
  assert.equal(won("candidate", "wizard"), 24040);
  assert.equal(won("candidate", "draw"), 0);
  assert.equal(opener("candidate"), 29068);
  assert.equal(opener("baseline"), 29706);
  assert.equal(SAME, 43058);
  assert.equal(CANDIDATE.cowboyShare.toFixed(2), "51.92");
  assert.equal(CANDIDATE.wizardShare.toFixed(2), "48.08");
  assert.equal(CANDIDATE.seatSkew.toFixed(3), "8.136");
  assert.equal(CANDIDATE.baselineSeatSkew.toFixed(3), "9.412");
});

test("the actual 51.92% candidate meets both requirements under the written contract", () => {
  assert.deepEqual(verdicts(contract, CANDIDATE), both(true, true));
});

test("editing NSB-1 from 45-55% to 49-51% turns the same 51.92% candidate red", () => {
  const narrow = parseBalanceContract(withBand(49, 51));
  assert.deepEqual(narrow.band, [49, 51]);
  assert.deepEqual(verdicts(narrow, CANDIDATE), both(false, true));
});

// One recorded set built from the audit; the same evidence is used for tune and holdout so only the
// contract text or the explicit policy varies between decisions.
const SET = Object.freeze({
  seeds: {from: AUDIT.firstSeed, to: AUDIT.firstSeed + AUDIT.deals - 1, deals: AUDIT.deals},
  baseline: {games: GAMES, seatSkew: CANDIDATE.baselineSeatSkew},
  candidate: {cowboyShare: CANDIDATE.cowboyShare, wizardShare: CANDIDATE.wizardShare, seatSkew: CANDIDATE.seatSkew},
  flips: {same: SAME},
});
const PROPERTIES = Object.freeze({baseline: {passed: true}, candidate: {passed: true}});
const decideWith = (policy, sets = {tune: SET, holdout: SET}) => decideAttempt({violations: [], properties: PROPERTIES, sets, policy});

test("the parsed contract drives the recorded decision and keeps its old messages", () => {
  const decide = (markdown) => decideWith({...POLICY, ...parseBalanceContract(markdown)});
  const written = decide(text);
  assert.equal(written.verdict, "PASS");
  assert.deepEqual(written.reasons, []);
  assert.equal(decideAttempt({violations: [], properties: PROPERTIES, sets: {tune: SET, holdout: SET}}).verdict, "PASS",
    "the default policy is the written contract");
  const narrow = decide(withBand(49, 51));
  assert.equal(narrow.verdict, "FAIL");
  assert.equal(narrow.pass, false);
  assert.equal(narrow.meaning, "Do not forward this candidate.");
  assert.ok(narrow.reasons.includes("tune: Cowboy share 51.92% is outside 49-51%"));
  assert.ok(narrow.reasons.includes("holdout: Cowboy share 51.92% is outside 49-51%"));
  assert.ok(narrow.reasons.includes("tune: Wizard share 48.08% is outside 49-51%"), "the Wizard share is checked as well");
  assert.ok(!narrow.reasons.some((reason) => /first-seat skew/.test(reason)), "seat skew shrank, so NSB-2 adds no reason");
});

test("an explicit historical policy decides, not the current written contract", () => {
  // A receipt recorded under a narrower band keeps failing even though requirements.md now says 45-55%.
  const recorded = {...POLICY, band: [49, 51], seatTolerancePp: 1};
  assert.deepEqual(contractProblems(recorded), []);
  assert.equal(decideWith(recorded).verdict, "FAIL");
  // A recorded zero tolerance still passes, because the candidate's seat skew shrank.
  assert.equal(decideWith({...POLICY, seatTolerancePp: 0}).verdict, "PASS");
  // A first-seat failure under an explicit policy is reported with that policy's tolerance.
  const grown = {...SET, candidate: {...SET.candidate, seatSkew: CANDIDATE.baselineSeatSkew + 2}};
  const seat = decideWith({...POLICY, seatTolerancePp: 1}, {tune: grown, holdout: SET});
  assert.deepEqual(seat.reasons, ["tune: first-seat skew grew 9.41 -> 11.41 pp (tolerance 1)"]);
  // The policy a malformed contract leaves behind cannot pass.
  const unusable = {...POLICY, band: [null, null], seatTolerancePp: null};
  assert.ok(contractProblems(unusable).length > 0);
  assert.equal(decideWith(unusable).verdict, "FAIL");
});

test("missing evidence in the recorded decision cannot pass", () => {
  assert.deepEqual(decideWith(POLICY, {tune: SET}).reasons, ["no holdout results"]);
  const noCandidate = {...SET, candidate: {}};
  const missing = decideWith(POLICY, {tune: noCandidate, holdout: SET});
  assert.equal(missing.verdict, "FAIL");
  assert.ok(missing.reasons.includes("tune: Cowboy share missing% is outside 45-55%"));
  assert.ok(missing.reasons.some((reason) => /^tune: first-seat skew grew/.test(reason)));
  const failedProperties = decideAttempt({violations: [], properties: {baseline: {passed: true}}, sets: {tune: SET, holdout: SET}});
  assert.deepEqual(failedProperties.reasons, ["candidate failed a property test or card-spec validation"]);
});

test("the band is inclusive at both edges", () => {
  const ok = {...CANDIDATE};
  assert.deepEqual(verdicts(contract, {...ok, cowboyShare: 55, wizardShare: 45}), both(true, true));
  assert.deepEqual(verdicts(contract, {...ok, cowboyShare: 45, wizardShare: 55}), both(true, true));
  assert.deepEqual(verdicts(contract, {...ok, cowboyShare: 55.001, wizardShare: 44.999}), both(false, true));
});

test("both factions are checked separately, so draws cannot hide a low share", () => {
  // 50% Cowboy with 12% draws leaves the Wizards at 38%.
  assert.deepEqual(verdicts(contract, {...CANDIDATE, cowboyShare: 50, wizardShare: 38}), both(false, true));
  assert.deepEqual(verdicts(contract, {...CANDIDATE, cowboyShare: 38, wizardShare: 50}), both(false, true));
  assert.deepEqual(verdicts(contract, {...CANDIDATE, cowboyShare: 50, wizardShare: 46}), both(true, true));
});

test("editing NSB-2's allowed seat-skew growth changes a synthetic decision", () => {
  // Opening player 59.5% -> 61%: skew grows 9.5 -> 11, by 1.5 pp.
  const grown = {cowboyShare: 50, wizardShare: 50, seatSkew: 11, baselineSeatSkew: 9.5};
  assert.deepEqual(verdicts(contract, grown), both(true, false));
  const looser = parseBalanceContract(withSeatTolerance(2));
  assert.equal(looser.seatTolerancePp, 2);
  assert.deepEqual(verdicts(looser, grown), both(true, true));
});

test("seat-skew growth of exactly the tolerance passes and a hair more fails", () => {
  const base = {cowboyShare: 50, wizardShare: 50, baselineSeatSkew: 8};
  assert.deepEqual(verdicts(contract, {...base, seatSkew: 9}), both(true, true));
  assert.deepEqual(verdicts(contract, {...base, seatSkew: 9.01}), both(true, false));
  assert.deepEqual(verdicts(contract, {...base, seatSkew: 3}), both(true, true), "a shrinking skew passes");
});

test("missing or non-finite observations cannot pass", () => {
  for (const bad of [undefined, null, NaN, Infinity, -Infinity, "51.92"]) {
    for (const key of ["cowboyShare", "wizardShare"]) {
      assert.equal(verdicts(contract, {...CANDIDATE, [key]: bad})[0].pass, false, `${key} = ${String(bad)}`);
    }
    for (const key of ["seatSkew", "baselineSeatSkew"]) {
      assert.equal(verdicts(contract, {...CANDIDATE, [key]: bad})[1].pass, false, `${key} = ${String(bad)}`);
    }
  }
  const {cowboyShare, ...noCowboy} = CANDIDATE;
  assert.equal(verdicts(contract, noCowboy)[0].pass, false);
  assert.deepEqual(verdicts(contract, {}), both(false, false));
});

test("duplicate, conflicting, invalid and unrecognised requirements fail closed", () => {
  const cases = {
    "duplicate NSB-1": `${text}\n${NSB1}\n`,
    "conflicting NSB-1": `${text}\n${NSB1.replace("45% to 55%", "46% to 54%")}\n`,
    "conflicting NSB-2": `${text}\n${NSB2.replace("at most 1 ", "at most 3 ")}\n`,
    "invalid id": edit(NSB1, NSB1.replace("NSB-1:", "NSB-X:")),
    "unrecognised NSB-3": `${text}\n- NSB-3: The draw share SHALL be at most 5%.\n`,
    "reworded NSB-1": edit(NSB1, NSB1.replace("Each faction's win share", "The Cowboy win share")),
    "missing NSB-2": edit(NSB2, ""),
    "missing NSB-1": edit(NSB1, ""),
    "non-numeric bound": edit(NSB1, NSB1.replace("45%", "forty-five%")),
  };
  for (const [name, markdown] of Object.entries(cases)) assert.throws(() => parseBalanceContract(markdown), BalanceContractError, name);
  assert.throws(() => parseBalanceContract(""), BalanceContractError, "empty text");
  assert.throws(() => parseBalanceContract(undefined), BalanceContractError, "no text");
  assert.throws(() => parseBalanceContract(edit(NSB1, "")), /missing NSB-1/, "the problem is named");
  assert.throws(() => parseBalanceContract(`${text}\n${NSB1}\n`), /duplicate NSB-1 \(first on line \d+\)/, "the duplicate cites the first line");
  assert.throws(() => loadBalanceContract(new URL("./no-such-requirements.md", REQUIREMENTS)), BalanceContractError, "unreadable file");
});

test("inverted or out-of-range bounds fail closed", () => {
  for (const [low, high] of [[55, 45], [51, 49], [-5, 55], [45, 105]]) {
    assert.throws(() => parseBalanceContract(withBand(low, high)), BalanceContractError, `${low}% to ${high}%`);
  }
  assert.throws(() => parseBalanceContract(withSeatTolerance(-1)), BalanceContractError, "negative seat tolerance");
  assert.throws(() => parseBalanceContract(withSeatTolerance(101)), BalanceContractError, "seat tolerance above 100");
});
