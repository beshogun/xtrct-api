# Use official Playwright image — includes Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install unzip (required by bun installer) + curl
RUN apt-get update && apt-get install -y unzip curl && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Ensure Playwright finds browsers from the base image
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install dependencies (playwright@1.58.2 matches base image)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .
RUN ls public/

EXPOSE 3000
CMD ["bun", "src/index.ts"]
