# Use official Playwright image — includes Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install unzip (required by bun installer) + curl
RUN apt-get update && apt-get install -y unzip curl && rm -rf /var/lib/apt/lists/*

# Install Bun (pin to 1.2.5 — 1.3.x segfaults under memory pressure; 1.1.x incompatible with Elysia 1.4)
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.2.5
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Tell Playwright where Chromium lives (pre-installed in this image)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# FlareSolverr instances (Railway services — override at runtime if needed)
ENV FLARESOLVERR_URL=https://flaresolverr-production-4fa8.up.railway.app
ENV FLARESOLVERR_URL_2=https://enthusiastic-hope-production.up.railway.app
ENV FLARESOLVERR_URL_3=https://divine-elegance-production-3328.up.railway.app

EXPOSE 3000
CMD ["bun", "src/index.ts"]
