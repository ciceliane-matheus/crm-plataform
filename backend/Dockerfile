FROM node:22-alpine

WORKDIR /app

# Copia apenas package.json e package-lock.json primeiro
COPY package*.json ./

RUN npm ci

# Copia todo o resto, exceto o que está no .dockerignore
COPY . .

CMD ["npm", "run", "dev"]