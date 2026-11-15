FROM python:3.12-slim
WORKDIR /app
COPY requirements.lock .
RUN pip install --no-cache-dir -r requirements.lock
COPY pyproject.toml .
COPY agentarena agentarena
RUN pip install --no-deps . && useradd --system arena
USER arena
CMD ["python","-m","agentarena.main"]
