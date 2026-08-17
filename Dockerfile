# Etapa de compilación: instala dependencias, ejecuta pruebas y genera /dist.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm test && npm run build

# Etapa de ejecución: Cloud Run inyecta PORT=8080 y Nginx sirve el SPA.
FROM nginx:1.27-alpine AS runtime
COPY GCP-infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
