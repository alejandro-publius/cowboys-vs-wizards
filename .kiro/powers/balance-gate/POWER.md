---
name: "balance-gate"
displayName: "Paired Balance Gate"
author: "Cowboys vs. Wizards"
repository: "https://github.com/alejandro-publius/cowboys-vs-wizards"
description: "Review a deterministic two-sided game's balance change. Explain which side or opening seat failed on the tuning or holdout seeds."
keywords: ["balance gate", "paired balance", "holdout seeds", "first-player advantage", "seat skew", "NSB-1", "NSB-2"]
---

# Paired Balance Gate

Try asking Kiro, “Run the paired balance gate on PLAN.json and EVIDENCE.json. Which cohort and rule explain the verdict?”

## Supply the two inputs

1. Choose two distinct side names and fix two nonoverlapping seed ranges before tuning. A plan can look like `{"sides":["red","blue"],"tune":{"firstSeed":100,"deals":20},"holdout":{"firstSeed":500,"deals":20}}`. Use the holdout after selecting the candidate.
2. Have the game's simulator play baseline and candidate on each identical seed and opening side. Keep everything except the proposed change fixed. Its evidence JSON contains `tune` and `holdout` arrays. Within each array, order rows by ascending seed, then by the plan's side order. Each range needs two rows per deal.
3. Each row contains both outcomes, for example `{"seed":100,"first":"red","baseline":{"winner":"red","endTurn":6},"candidate":{"winner":"blue","endTurn":7}}`. Report a genuine draw as `"draw"` or `null` and the final turn as a positive integer.

## Run the gate

From the game's workspace, point Node at a reviewed checkout of Cowboys vs. Wizards and supply the two local JSON paths. The command reads the recorded outcomes.

```sh
node /path/to/cowboys-vs-wizards/packages/frontier-kit/balance-gate.mjs PLAN.json EVIDENCE.json
```

For GitHub Actions, use this pinned step after the calling repository checks out its game and produces both files. [Frontier Kit instructions](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/27583b16aab4ab38805fab93b720d383eb4fb7d8/packages/frontier-kit/README.md)

```yaml
- uses: alejandro-publius/cowboys-vs-wizards/packages/frontier-kit@27583b16aab4ab38805fab93b720d383eb4fb7d8
  with:
    plan: PLAN.json
    evidence: EVIDENCE.json
```

## Explain the verdict

- **PASS (exit 0)** means both rules held on each of the two measured cohorts. Report the number of games per arm in each cohort.
- **REJECT (exit 2)** means at least one rule failed. Name each failing cohort and rule. For **NSB-1**, give the candidate side's measured win share and the inclusive 45–55% band. For **NSB-2**, give the baseline and candidate opening-player win shares, their respective distances from 50%, and how much that distance grew. Growth of up to 1 percentage point passes. All shares use every game in that arm as the denominator, including draws.
- **INVALID (exit 1)** means the gate could not evaluate the supplied files. Quote its diagnostic and identify the input that needs correction. Leave the plan, evidence and game rules untouched during review.
