# ---------- Stage 1: build da SPA ----------
FROM node:20-alpine AS build
WORKDIR /app

# Copia somente manifests primeiro para aproveitar o cache de camadas.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copia o restante do código e gera o bundle estático.
COPY . .
RUN npm run build

# ---------- Stage 2: serve estático com nginx ----------
FROM nginx:alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
