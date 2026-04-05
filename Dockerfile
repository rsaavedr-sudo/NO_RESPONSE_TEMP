FROM node:18-slim

# Instalar dependencias necesarias para node-gyp u otros módulos nativos
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias de forma limpia
RUN npm ci

# Copiar el resto del código
COPY . .

# Exponer el puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "run", "dev:frontend"]
