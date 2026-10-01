# CampusVoice (Nirbhik) — Production Deployment & Hardening Guide

> Comprehensive deployment runbook for hosting CampusVoice across on-premise university infrastructure or managed cloud providers (Docker, PostgreSQL + pgvector, pg-boss worker, and reverse proxy). Complies with **ARCHITECTURE.md §14**.

---

## 1. Production Architecture Overview

A production CampusVoice cluster consists of:
1. **API Server (`campusvoice-server`)**: Node.js/Express handling REST APIs, SSE notifications, and auth sessions.
2. **Background Worker (`campusvoice-worker`)**: Dedicated process executing `pg-boss` queues (`analyze-complaint`, `sla-escalation`, `sos-dispatch`, `embed-rules`).
3. **Frontend Client (`campusvoice-client`)**: Static SPA assets served via Nginx or Cloudflare Pages.
4. **PostgreSQL Database (`postgres:16`)**: With `pgvector` extension enabled and dual-role schema isolation (`public` vs `vault`).
5. **Reverse Proxy (Nginx / Caddy)**: Terminates TLS/HTTPS, enforces HTTP/2 or HTTP/3, and applies defensive caching headers.

---

## 2. Multi-Stage Production Dockerfile

### Server Dockerfile (`server/Dockerfile`)
```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY src ./src/
RUN npm run build

# Production Runtime Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

# Non-root user execution
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Client Dockerfile (`client/Dockerfile`)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json vite.config.ts ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 3. Production Docker Compose Configuration

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: always
    environment:
      POSTGRES_DB: campusvoice
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_SUPERUSER_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - internal-net

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: always
    environment:
      PORT: 4000
      NODE_ENV: production
      DATABASE_URL: postgresql://campus_app:${DB_APP_PASSWORD}@postgres:5432/campusvoice?schema=public
      VAULT_DATABASE_URL: postgresql://campus_vault:${DB_VAULT_PASSWORD}@postgres:5432/campusvoice?schema=vault
      VAULT_KEY: ${VAULT_KEY}
      TRACKING_KEY_PEPPER: ${TRACKING_KEY_PEPPER}
      AUTH_SECRET: ${AUTH_SECRET}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      APP_URL: https://voice.university.edu
    depends_on:
      - postgres
    networks:
      - internal-net

  worker:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: always
    command: ["node", "dist/worker.js"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://campus_app:${DB_APP_PASSWORD}@postgres:5432/campusvoice?schema=public
      VAULT_DATABASE_URL: postgresql://campus_vault:${DB_VAULT_PASSWORD}@postgres:5432/campusvoice?schema=vault
      VAULT_KEY: ${VAULT_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: 587
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
    depends_on:
      - postgres
    networks:
      - internal-net

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - server
    networks:
      - internal-net

volumes:
  pgdata:

networks:
  internal-net:
    driver: bridge
```

---

## 4. Nginx Reverse Proxy & TLS Configuration

```nginx
server {
    listen 80;
    server_name voice.university.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name voice.university.edu;

    ssl_certificate /etc/letsencrypt/live/voice.university.edu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/voice.university.edu/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static UI
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://server:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE Stream buffering disabled
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## 5. Deployment Checklist & Health Probes

1. **Database Migrations & Seed**:
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed
   ```
2. **Liveness & Readiness Health Probes**:
   - `GET /api/health` returns `200 OK` with database status `connected`.
   - `GET /api/transparency` returns operational statutory metrics.
3. **Queue Monitoring**:
   - Worker runs pg-boss with auto-reconnection and exponential backoff retry.
4. **Log Rotation**:
   - Docker JSON logs configured with `max-size: 50m` and `max-file: 5`.
