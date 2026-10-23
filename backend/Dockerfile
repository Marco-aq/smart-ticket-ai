FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home appuser
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser models ./models
USER appuser
EXPOSE 8000
# One worker: the demo uses an in-memory rate-limit store.
# Do not trust client-supplied forwarding headers on the public backend.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --no-proxy-headers"]
