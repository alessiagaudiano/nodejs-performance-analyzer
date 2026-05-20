COMPOSE ?= docker compose

-include .env.docker

.PHONY: up down logs db-shell console restart ps test

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

restart:
	$(COMPOSE) restart

console:
	$(COMPOSE) up -d --build
	$(COMPOSE) exec web sh

db-shell:
	$(COMPOSE) up -d db
	$(COMPOSE) exec db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

clean:
	$(COMPOSE) down -v --remove-orphans --rmi local
	docker volume prune -f
	docker network prune -f
	docker image prune -f

test:
	@set -e; \
	trap '$(COMPOSE) down' EXIT; \
	$(COMPOSE) up -d --build; \
	$(COMPOSE) exec web pytest tests/unit/test_services.py -vv; \
	$(COMPOSE) exec web pytest tests/integration/test_services.py -vv; \
	$(COMPOSE) exec web pytest tests/integration/test_apis.py -vv; \
	$(COMPOSE) exec web pytest tests/api_scenarios/test_api_scenarios.py -vv
