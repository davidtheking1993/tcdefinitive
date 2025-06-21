FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libgraphene-1.0-0 \
    libgstreamer-gl1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libenchant-2-2 \
    libsecret-1-0 \
    libgles2-mesa \
    fonts-liberation \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

RUN npx playwright install-deps
RUN npx playwright install

COPY . .

CMD ["node", "index.js"]
