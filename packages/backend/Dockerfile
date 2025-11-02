# 1. Base image
FROM oven/bun:1.2-debian AS base

# Ensure OpenSSL headers are available so Prisma detects the right binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Install dependencies
# Copy root dependency files
COPY package.json bun.lock ./

# Copy all package.json files for workspaces
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install ALL workspace dependencies from the root
RUN bun install --frozen-lockfile

# 3. Copy all source code
# Copy the entire packages directory
COPY packages ./packages

# 4. Generate Prisma client
# Force Prisma to build the OpenSSL 3.0-compatible binary
ENV PRISMA_CLI_BINARY_TARGETS="native,debian-openssl-3.0.x"
RUN bunx prisma generate --schema=./packages/backend/prisma/schema.prisma

# 5. Build the backend
# This runs the "build" script inside packages/backend/package.json
RUN bun run --cwd packages/backend build

# 6. Final runtime image
FROM base AS final
WORKDIR /app

# Copy only the necessary node_modules
COPY --from=base /app/node_modules ./node_modules

# Copy the built backend and its package.json
COPY --from=base /app/packages/backend ./packages/backend

# Copy the built shared package
COPY --from=base /app/packages/shared ./packages/shared

# Copy root workspace manifest for dependency resolution in production
COPY --from=base /app/package.json ./package.json

# Copy the generated Prisma engine
COPY --from=base /app/node_modules/.prisma/client ./node_modules/.prisma/client

# Set the working directory to the backend for the start command
WORKDIR /app/packages/backend

# The start command is "bun run start" from the backend's package.json
CMD ["bun", "run", "start"]
