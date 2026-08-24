# Etapa de compilación: instala dependencias, ejecuta pruebas y genera /dist.
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_SINPE_PHONE="+506 8362-9162"
ENV VITE_SINPE_PHONE=$VITE_SINPE_PHONE

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN node --check src/test/setup.js && npm test && npm run build

# Etapa de ejecución: el servidor crea eventos en Google Calendar y sirve el SPA.
RUN npm prune --omit=dev

# Verifica durante el build que el mismo servidor de producción pueda iniciar
# y responder en el puerto que Cloud Run inyectará en tiempo de ejecución.
RUN PORT=8080 node server.js & pid=$!; \
  for attempt in 1 2 3 4 5 6 7 8 9 10; do \
    if wget -q -O /dev/null http://127.0.0.1:8080/health && \
       wget -q -O /tmp/logo.svg http://127.0.0.1:8080/autoestudiocr-logo.svg && \
       grep -q '<svg' /tmp/logo.svg; then kill "$pid"; wait "$pid" || true; exit 0; fi; \
    sleep 1; \
  done; \
  kill "$pid" 2>/dev/null || true; exit 1

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=384
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json server.js notifications.js ./

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-8080}/health" || exit 1
CMD ["node", "server.js"]
