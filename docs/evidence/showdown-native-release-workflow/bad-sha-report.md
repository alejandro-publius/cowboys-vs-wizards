# Showdown release review: refused

Expected SHA: 2fcf39b7fe4db6f78cb33f6b2c474e053e89bbc7

| # | Command | Exit |
|---|---------|------|
| 1 | `git rev-parse HEAD` | 0 (c529330dc724108d72035f9bc46ba726a0612d8a) |
| 2 | `git symbolic-ref -q HEAD` | 1 (detached) |
| 3 | `git status --porcelain --untracked-files=all` | 0 (clean, no output) |
| 4 | `node scripts/showdown-release-review.mjs --expected 2fcf39b7fe4db6f78cb33f6b2c474e053e89bbc7` | 3 |
| 5 | receipt check | not run (no receipt.json written) |

Refusal text printed by step 4:

```
REFUSED:
- HEAD c529330dc724108d72035f9bc46ba726a0612d8a is not the expected 2fcf39b7fe4db6f78cb33f6b2c474e053e89bbc7
```

No checkout, stash, clean or rebuild was attempted.

Pending or blocked: all Node suites, turn simulations, build and browser checks did not run. No receipt exists.

Limits:
These are scripted headless Chrome and Node checks on one Mac and support flow, storage and hidden-information claims only.
Art and appearance need the art owner's rendered review.
Clarity and fun need a human playtest.
Phones, tablets, Safari and other GPUs are not covered.
Deployed (Pages) identity is not checked.

Human approval: pending
Art/device approval: pending

refused
