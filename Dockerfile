# Build stage for client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Build stage for server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy server
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules

# Copy client build to serve as static files
COPY --from=client-builder /app/client/dist ./public

# Expose port
EXPOSE 3001

# Start server (it will serve both API and static files)
CMD ["node", "dist/index.js"]
