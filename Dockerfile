FROM node:22-alpine AS frontend-build

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY public ./public
COPY scripts ./scripts
RUN npm run build

FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

COPY --chown=node:node server ./server
COPY --chown=node:node private-data ./private-data
COPY --from=frontend-build --chown=node:node /build/dist ./dist

USER node
EXPOSE 8080

CMD ["node", "server/server.mjs"]
