# ── Stage 1: build the React bundle ────────────────────────────────
# Node 24 to match package.json "engines" and .nvmrc. Vercel rejects 20.x as
# discontinued, and the three pins must agree or image builds silently run a
# different Node than CI.
FROM node:24-alpine AS build

WORKDIR /app

# Install from the lockfile only, so an image build cannot silently resolve a
# newer minor than the one that was tested.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# REACT_APP_* values are inlined into the bundle at build time.
# Leave REACT_APP_API_URL empty so every request is same-origin and nginx
# proxies /api to the backend container — no CORS preflight.
ARG REACT_APP_API_URL=""
ARG REACT_APP_SOCKET_URL=""
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}
ENV CI=false
ENV GENERATE_SOURCEMAP=false

# react-scripts 5 (webpack 5) uses md4, which OpenSSL 3 removes, hence
# --openssl-legacy-provider. The heap ceiling matters too: this bundle builds
# large enough to OOM node's default heap on constrained runners.
ENV NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=4096"

RUN npm run build

# ── Stage 2: serve the static bundle ───────────────────────────────
FROM nginx:1.27-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
