# ===================================
# ETAPA 1 - Build do React
# ===================================

FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# ===================================
# ETAPA 2 - Servidor Node
# ===================================

FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/

RUN cd server && npm ci --omit=dev

COPY server ./server

COPY --from=frontend-build /app/dist ./dist

ENV NODE_ENV=production

ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/server.js"]