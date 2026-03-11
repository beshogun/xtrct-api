FROM ubuntu:22.04

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system deps for Playwright + Chromium + Bun
RUN apt-get update && apt-get install -y \
    curl unzip ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libpangocairo-1.0-0 \
    libxshmfence1 libx11-xcb1 libxcb-dri3-0 libdbus-1-3 \
    fonts-liberation wget \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies (playwright@1.58.2)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Download Playwright's Chromium (headless shell) for playwright@1.58.2
RUN bunx playwright install --with-deps chromium

# Copy source
COPY . .
RUN ls public/

EXPOSE 3000
CMD ["bun", "src/index.ts"]
