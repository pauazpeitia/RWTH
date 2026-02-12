# --- Stage 1: Frontend build ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app_frontend
COPY frontend/package*.json ./

ENV NODE_ENV=development
RUN npm install

COPY frontend/ .
RUN npm run build

# --- Stage 2: Python runtime ---
FROM python:3.12-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App-Code
COPY . .

# Frontend build ins Image
COPY --from=frontend-builder /app_frontend/build /app/frontend/build

ENV DJANGO_SETTINGS_MODULE=vm_gui.settings
ENV PYTHONUNBUFFERED=1

RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn","vm_gui.wsgi:application","--bind","0.0.0.0:8000"]