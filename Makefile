.PHONY: dev install install-back install-front back front build build-back build-front test test-back test-front lint clean

# Run both workspaces in parallel. Ctrl-C kills both.
dev:
	@echo ">> shop-back :3002  |  shop-front :3001"
	@trap 'kill 0' INT TERM; \
	  (cd shop-back && bun --watch src/main.ts --port 3002) & \
	  (cd shop-front && bun --bun vite dev --port 3001) & \
	  wait

install: install-back install-front

install-back:
	cd shop-back && bun install

install-front:
	cd shop-front && bun install

back:
	cd shop-back && bun run start:dev

front:
	cd shop-front && bun --bun run dev

build: build-back build-front

build-back:
	cd shop-back && bun run build

build-front:
	cd shop-front && bun --bun run build

test: test-back test-front

test-back:
	cd shop-back && bun run test

test-front:
	cd shop-front && bun --bun run test

lint:
	cd shop-back && bun run lint
	cd shop-front && bun --bun run check
