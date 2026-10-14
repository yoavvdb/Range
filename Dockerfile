# Range server: accounts, connected platforms synced hourly, and the Range app.
# The Playwright image ships Node and the Chromium build that matches playwright 1.64.0 (used by the SugarWOD connector).
FROM mcr.microsoft.com/playwright:v1.64.0-noble

WORKDIR /app
# dependencies (playwright, web-push) come from the sync tool's lockfile; the server shares them
COPY sugarwod-sync/package.json sugarwod-sync/package-lock.json sugarwod-sync/
RUN cd sugarwod-sync && npm ci --omit=dev --no-audit --no-fund
COPY sugarwod-sync/src sugarwod-sync/src
COPY server/package.json server/
COPY server/src server/src
RUN ln -s /app/sugarwod-sync/node_modules /app/server/node_modules
# the built app (python3 build/build.py writes site/)
COPY site site

ENV NODE_ENV=production PORT=8080 RANGE_DB=/data/range.db RANGE_SITE=/app/site
RUN mkdir -p /data && chown pwuser /data
VOLUME /data
USER pwuser
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
