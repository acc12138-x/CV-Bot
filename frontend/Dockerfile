# ---- 前端：多阶段构建，产物给 nginx 用 ----
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 只保留构建产物，不跑容器，交给宿主 nginx 托管
FROM alpine:3.20 AS dist
COPY --from=build /app/dist /dist
CMD ["sh", "-c", "echo 'frontend dist built'"]