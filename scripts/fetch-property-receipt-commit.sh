#!/bin/sh
set -eu

revision=$(jq -er '.commit | select(type == "string" and test("^[0-9a-f]{40}$"))' reports/properties/latest.json)
git fetch --no-tags --depth=1 https://github.com/alejandro-publius/cowboys-vs-wizards.git "$revision"
test "$(git cat-file -t "$revision")" = commit
