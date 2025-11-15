FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY src ./src
# Node 22 runs the TypeScript sources directly (type stripping), so there is no build step.
USER node
ENV HOST=0.0.0.0 PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "src/index.ts"]
