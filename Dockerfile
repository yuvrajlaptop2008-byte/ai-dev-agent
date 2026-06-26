FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN cd frontend && npm install && npm run build
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
