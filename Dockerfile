FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app

# Run as a dedicated non-root user (audit M: containers ran as root).
RUN groupadd -r valerie && useradd -r -g valerie --home-dir /app valerie

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY src/ ./src/
COPY resources/ ./resources/
COPY alembic/ ./alembic/
COPY alembic.ini .

ENV PYTHONPATH=src

# Container-level liveness probe (Cloud Run also probes /health at the app level).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=4).status==200 else 1)" || exit 1

USER valerie
EXPOSE 8080
