# Use official Playwright image — includes Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app

# Install unzip (required by bun installer) + curl
RUN apt-get update && apt-get install -y unzip curl && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
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
