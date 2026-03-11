FROM debian:bookworm-slim

WORKDIR /app

# Install minimal deps
RUN apt-get update && apt-get install -y curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install Node dependencies (skip playwright browser download)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source and static files
COPY src/ ./src/
COPY public/ ./public/

# Verify
RUN ls -la public/

EXPOSE 3000
CMD ["bun", "src/index.ts"]
