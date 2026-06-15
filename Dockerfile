FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY src/ src/

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
