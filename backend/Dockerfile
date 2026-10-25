# WhatsApp CRM backend — production image.
#
# Chromium is NOT optional: whatsapp-web.js drives a real browser for the
# WhatsApp Web engine (QR pairing). Without it only the Meta Cloud API path
# works, and any attempt to pair a number fails at session creation.
FROM node:24-bookworm-slim

WORKDIR /app

# Chromium plus the shared libraries Puppeteer needs. Split into its own layer so
# it is cached across code deploys.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      libnss3 \
      libnspr4 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      dumb-init \
    && rm -rf /var/lib/apt/*

# Use the system Chromium instead of downloading a bundled one.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Puppeteer needs a writable Chrome profile directory and must run non-root when
# the container allows it; --no-sandbox is required because Docker's default
# seccomp profile blocks the Chromium sandbox.
ENV NODE_ENV=production

# npm ci (not npm install) so the image is built from the lockfile. It also
# runs the postinstall hook, which is what applies patches/ — see below.
#
# patches/ MUST be copied BEFORE npm ci. The postinstall hook is patch-package,
# which looks for patches/ relative to the project root; if only package.json
# and package-lock.json are present, it prints "No patch files found", exits 0
# (the hook ends in `|| echo "Patch applied or skipped"`), and the image ships an
# UNPATCHED whatsapp-web.js. That build looks perfect and then pairs a QR
# successfully only to drop the session minutes later — which reads as a
# WhatsApp problem and is not one.
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Re-apply after the full source is in place, and fail the build if a patch does
# not apply. This is the belt-and-braces guard: the postinstall above is allowed
# to no-op, so without this a silently unpatched image would still build green.
RUN npx patch-package --error-on-fail

# uploads/ and the paired WhatsApp session must NOT live inside the container
# layer. Mount a volume (or a Render disk) here, or a redeploy orphans a live
# session and every number must be re-paired by hand.
#
# /var/data is the path render.yaml mounts its disk at and the value it sets for
# WA_DATA_DIR, so the two must agree.
ENV WA_DATA_DIR=/var/data
RUN mkdir -p /var/data/uploads /var/data/whatsapp-sessions /var/data/logs /var/data/backups \
    && chown -R node:node /var/data
VOLUME ["/var/data"]

# Matches PORT in .env.production.example.
EXPOSE 5001

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node scripts/readiness-check.js

# dumb-init reaps the Chromium and Puppeteer child processes. Without an init,
# a restart can leave orphaned browser processes holding the session profile.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
