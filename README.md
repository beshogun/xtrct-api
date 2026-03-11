# Scraper API

## Quick Start (Docker Compose)

```bash
cp .env.example .env
# fill in DATABASE_URL and STRIPE keys
docker compose up
```

```bash
# Or run just FlareSolverr alongside local dev:
docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
bun src/index.ts
```
