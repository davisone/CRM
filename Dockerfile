# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate

# ---- Build ----
FROM base AS build
RUN npm run build

# ---- App ----
FROM node:20-alpine AS app
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated

EXPOSE 3000

# Run migrations then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]

# ---- Worker ----
FROM node:20-alpine AS worker
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/.next ./.next
COPY --from=base /app/worker ./worker
COPY --from=base /app/src ./src
COPY --from=base /app/tsconfig.json ./

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx worker/index.ts"]
