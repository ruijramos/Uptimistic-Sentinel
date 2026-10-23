# Build stage
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build -- --configuration production

# Serve stage
FROM nginx:alpine

# Copy built Angular static assets to Nginx html directory
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Copy reverse proxy configuration
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
