# Use official Playwright image — includes Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.44.0-jammy AS builder

WORKDIR /app

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .

# ─── Runtime ─────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

COPY --from=builder /app /app

# Tell Playwright where Chromium lives (pre-installed in this image)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 3000
CMD ["bun", "src/index.ts"]
