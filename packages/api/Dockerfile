FROM node:24-alpine AS base
WORKDIR /app

FROM base AS builder
# Copy root monorepo manifest & configuration
COPY package.json package-lock.json turbo.json ./
# Copy workspace packages required by API
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

# Install monorepo dependencies
RUN npm ci

# Build shared and api packages using Turborepo
RUN npx turbo build --filter=@system-design/api...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and built API package
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "packages/api/dist/index.js"]
