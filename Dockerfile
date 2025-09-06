FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install -g @nestjs/cli
RUN npm install --production
COPY . .
RUN npm run build && ls -al dist
ENV NODE_ENV=production
CMD ["node", "dist/src/main.js"]
