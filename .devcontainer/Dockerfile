FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Install Node.js 20.x and pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
