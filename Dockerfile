# Use official Playwright image — includes Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install unzip (required by bun installer) + curl
RUN apt-get update && apt-get install -y unzip curl && rm -rf /var/lib/apt/lists/*

# Install Bun (pin to 1.1.38 — 1.2.x and 1.3.x segfault under memory pressure)
RUN curl -fsSL https://bun.sh/install | bash -s -- bun-v1.1.38
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Tell Playwright where Chromium lives (pre-installed in this image)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 3000
CMD ["bun", "src/index.ts"]
