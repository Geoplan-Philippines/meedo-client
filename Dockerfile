FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS installer
COPY package*.json ./
RUN npm install

FROM installer AS builder
COPY . .
ARG API_BASE_URL=https://meedo-v3-api-stg.geoplanph.com/api/v1
RUN sed -i "s|apiBaseUrl:.*|apiBaseUrl: '${API_BASE_URL}',|" src/environments/environment.prod.ts
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist/meedo-v3/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
