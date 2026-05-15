FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PYTHONDONTWRITEBYTECODE=1

# System deps for weasyprint (PDF) + healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 libpangoft2-1.0-0 \
    libcairo2 libgdk-pixbuf-2.0-0 \
    fonts-dejavu \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --upgrade pip setuptools wheel
# Install runtime deps explicitly so the image is reproducible
RUN pip install \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic>=2.8" "pydantic-settings>=2.4" \
    "httpx>=0.27" "websockets>=12.0" "aiofiles>=24.0" \
    "asyncpg>=0.29" "aiosqlite>=0.20" \
    "google-genai>=0.3" "speechmatics-python>=2.0" \
    "jinja2>=3.1" "weasyprint>=62.0" "markdown>=3.6" \
    "structlog>=24.0" "rich>=13.0" "python-dotenv>=1.0"

COPY . .

ENV PYTHONPATH=/app
EXPOSE 8088 8089 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD curl -fsS http://localhost:8088/health || exit 1

CMD ["python", "-m", "api.main"]
