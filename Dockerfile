FROM node:18

WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
RUN npm install

# Copiar el código de la aplicación
COPY . .

# Exponer el puerto del frontend
EXPOSE 3000

# Comando para ejecutar el frontend en modo desarrollo
# Usamos dev:frontend para evitar que intente levantar el backend de Python en este contenedor
CMD ["npm", "run", "dev:frontend"]
