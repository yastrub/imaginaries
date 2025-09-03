# Frontend Production
FROM node:18-alpine as build
LABEL name="imaginaries-frontend"
LABEL version="1.0"

WORKDIR /app

# Copy production package.json first
COPY package.prod.json ./package.json
RUN npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production image
FROM nginx:alpine

# Copy NGINX configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy .env file for runtime access
COPY --from=build /app/.env /usr/share/nginx/html/.env

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]