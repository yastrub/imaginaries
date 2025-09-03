# Backend Production
FROM node:18-alpine AS build
LABEL name="imaginaries-backend"
LABEL version="1.0"

WORKDIR /app

# Copy package files first
COPY package.prod.json ./package.json

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p dev-data/uploads

# Copy .env file
COPY .env .env

# Start server
CMD ["npm", "start"]