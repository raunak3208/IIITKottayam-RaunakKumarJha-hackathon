.PHONY: up down logs validate clean

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

validate:
	node scripts/validateContracts.js

clean:
	docker compose down -v
