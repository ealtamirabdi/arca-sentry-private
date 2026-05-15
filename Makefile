.PHONY: help install dev test lint format clean run-api run-orchestrator docker-up docker-down

help:
	@echo "ARCA SENTRY — make targets:"
	@echo "  install        Install dependencies in a venv"
	@echo "  dev            Run full stack with docker-compose"
	@echo "  test           Run test suite"
	@echo "  lint           Ruff + mypy"
	@echo "  format         Format with ruff"
	@echo "  run-api        Run FastAPI only"
	@echo "  run-orchestrator  Run orchestrator only"
	@echo "  docker-up      docker-compose up"
	@echo "  docker-down    docker-compose down"
	@echo "  clean          Remove build artifacts"

install:
	python3 -m venv .venv
	.venv/bin/pip install -U pip
	.venv/bin/pip install -e ".[dev]"

dev: docker-up

test:
	.venv/bin/pytest -v --cov=core --cov=agents --cov=capture --cov=synthesizer

lint:
	.venv/bin/ruff check .
	.venv/bin/mypy core agents capture synthesizer adapters

format:
	.venv/bin/ruff format .
	.venv/bin/ruff check --fix .

run-api:
	.venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8088 --reload

run-orchestrator:
	.venv/bin/python -m core.orchestrator

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

clean:
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name '*.egg-info' -exec rm -rf {} +
	rm -rf .pytest_cache .mypy_cache .ruff_cache .coverage htmlcov dist build
