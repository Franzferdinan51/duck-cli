FROM node:20-alpine

LABEL maintainer="DuckBot"
LABEL description="🦆 Duck Agent - AI Agent System"

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create directories
RUN mkdir -p /app/data /app/logs

# Set environment
ENV NODE_ENV=production

# Expose ports
EXPOSE 3000 3848 18789

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:18789/health || exit 1

# Default command
CMD ["node", "dist/cli/main.js", "gateway"]
