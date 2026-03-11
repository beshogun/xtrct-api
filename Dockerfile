# Use official Playwright image — includes Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install unzip (required by bun installer) + curl
RUN apt-get update && apt-get install -y unzip curl && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Install the correct Chromium for this Playwright version
RUN bunx playwright install chromium

# Copy source (ARG busts cache when incremented)
ARG CACHEBUST=2
COPY . .

EXPOSE 3000
CMD ["bun", "src/index.ts"]
