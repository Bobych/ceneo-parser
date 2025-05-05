FROM node:18-slim

RUN apt-get update && apt-get install -y \
    dbus-x11 \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libnss3-dev \
    libgdk-pixbuf2.0-0 \
    libxss1 \
    libappindicator3-1 \
    libgbm1 \
    libnspr4 \
    lsb-release \
    wget \
    ca-certificates \
    --no-install-recommends

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN npm run build
EXPOSE 3333
CMD ["npm", "run", "start:prod"]