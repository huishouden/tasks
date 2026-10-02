#!/bin/sh
# The browser tests run against the household's real Firestore rules, which live in huishouden/rules.
# Fetched fresh for each run (not committed), so a rules change there is tested here on the next run.
# RULES_REF picks another branch or commit, e.g. RULES_REF=my-branch to try a rules PR with this app.
set -eu
dir=$(dirname "$0")
curl -fsSL "https://raw.githubusercontent.com/huishouden/rules/${RULES_REF:-main}/firestore.rules" -o "$dir/firestore.rules"
