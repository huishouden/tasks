#!/bin/sh
# The browser tests run against the household's real Firestore rules, which live in huishouden/rules.
# Fetched fresh for each run (not committed) from main, because main is what is deployed: testing
# against it catches the app and the live rules disagreeing, at the cost of a re-run of an old commit
# possibly seeing newer rules. RULES_REF pins another branch or commit, e.g. RULES_REF=my-branch to
# try a rules PR with this app, or RULES_REF=<sha> to reproduce an old run exactly.
set -eu
dir=$(dirname "$0")
# Written aside and moved into place, so a run alongside (E2E_PORT_OFFSET) never reads half a file.
tmp=$(mktemp "$dir/firestore.rules.XXXXXX")
trap 'rm -f "$tmp"' EXIT
curl -fsSL --retry 4 --retry-all-errors --retry-delay 3 "https://raw.githubusercontent.com/huishouden/rules/${RULES_REF:-main}/firestore.rules" -o "$tmp"
mv "$tmp" "$dir/firestore.rules"
