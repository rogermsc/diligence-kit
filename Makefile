COMPOSE := docker compose -f docker-compose.demo.yml

.PHONY: help demo demo-logs demo-down dev test lint fixtures fixtures-check

help:
	@echo "make demo        Bring up a complete demo with no cloud account and no API key"
	@echo "make demo-logs   Follow the demo's logs"
	@echo "make demo-down   Stop the demo and delete its data"
	@echo "make dev         Start postgres and redis only, to run the apps natively"
	@echo "make test        Run the test suites"
	@echo "make lint        Lint every app"
	@echo "make fixtures       Re-record the offline LLM fixtures and demo artefacts"
	@echo "make fixtures-check Replay both pipelines against the committed fixtures"

demo:
	$(COMPOSE) up -d --build
	@echo "Waiting for the API..."
	@n=0; until curl -sf http://localhost:3001/health >/dev/null 2>&1; do \
		n=$$((n+1)); \
		if [ $$n -ge 60 ]; then \
			echo "The API did not come up. Last 40 lines:"; \
			$(COMPOSE) logs --tail=40 service; \
			exit 1; \
		fi; \
		sleep 2; \
	done
	$(COMPOSE) exec -T service npx prisma migrate deploy
	$(COMPOSE) exec -T liaison-agent alembic upgrade head
	$(COMPOSE) exec -T service pnpm exec ts-node -r tsconfig-paths/register scripts/seed-demo.ts
	@echo ""
	@echo "  Dashboard  http://localhost:3000"
	@echo "  Sign in    you@example.com / demo-password"
	@echo ""
	@echo "  Northwind Robotics has a completed analysis of a four-document"
	@echo "  dataroom whose FY2024 revenue figures disagree on purpose."

demo-logs:
	$(COMPOSE) logs -f

demo-down:
	$(COMPOSE) down -v

dev:
	docker compose -f docker-compose.dev.yml up -d

test:
	pnpm test
	cd apps/agent && python -m pytest -q

lint:
	pnpm lint
	cd apps/agent && ruff check .
	cd apps/liaison-agent && ruff check .

# Rerun after changing anything the fixture key is built from: a prompt, a
# LLM_MODEL_* value, the Excel renderer, or the dataroom itself. Writes
# fixtures/llm/ and fixtures/demo-output/, both committed. Makes no API call.
fixtures:
	cd apps/agent && python scripts/record_demo_fixtures.py

# The check to run when you are not sure whether the committed fixtures still
# match the prompts in the tree. Fails on the first replay miss.
fixtures-check:
	cd apps/agent && python scripts/record_demo_fixtures.py --check
