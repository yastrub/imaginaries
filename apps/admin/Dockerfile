# syntax=docker/dockerfile:1.7
# Next.js Dockerfile (admin) using standalone output

FROM node:20-alpine AS build
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_COLOR=false \
    npm_config_color=false
RUN npm i -g npm@11.5.2
WORKDIR /app
# Install dependencies once
COPY package.json package-lock.json ./
# Copy postinstall scripts (required by package.json's postinstall)
COPY scripts/ ./scripts/
# Use BuildKit cache for npm cache to speed up repeated installs
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --fund=false
# Copy application source and build
COPY . .
# Persist Next.js incremental cache across builds for faster compiles
RUN --mount=type=cache,target=/app/.next/cache \
    --mount=type=secret,id=appenv,target=/tmp/app.env \
    sh -lc 'set -a; [ -f /tmp/app.env ] && . /tmp/app.env; set +a; npm run build'

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_COLOR=false \
    npm_config_color=false
# Default port inside container (overridable at runtime)
ENV PORT=3000
EXPOSE 3000

# Copy minimal standalone server and static assets
# For Next.js standalone, static assets must be at ./.next/static and public at ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
# Start the standalone server (standalone copies server.js to the root of the target directory)
CMD ["node","./scripts/run-migrations.js","&&","node","server.js"]