# Development image for apps/ai (FastAPI). Runs with --reload against the
# bind-mounted source (see docker-compose.yml).
FROM python:3.12-slim

WORKDIR /workspace/apps/ai

COPY apps/ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
