FROM node:20 AS build
WORKDIR /app

# Ambil package.json dulu
COPY package.json package-lock.json* ./

# Hapus node_modules host kalau nyasar, lalu install
RUN rm -rf node_modules && npm install --no-audit --no-fund

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript pake path binarinya langsung
RUN ./node_modules/.bin/tsc -p tsconfig.json

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WA_PORT=3001
ENV WA_DATA_DIR=/app/data

# Kalau Debian, tambahin system group dan user pake flag Debian
RUN addgroup --system app && adduser --system --ingroup app app

# Cuma pruning devDependencies buat runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data && chown -R app:app /app
USER app

EXPOSE 3001
CMD ["node", "dist/server.js"]
