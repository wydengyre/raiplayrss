#!/usr/bin/env just --justfile

default:
	just --list --justfile {{justfile()}}

check: lint typecheck

ci: ci-check test

ci-check: ci-lint typecheck

ci-lint:
	npm run ci-lint

lint:
  npm run lint

test:
	npm test --workspaces

typecheck:
	npm run typecheck --workspaces
