# Usar una imagen de Node.js
FROM node:22-alpine

# Crear y establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar primero los archivos de dependencias 
COPY package*.json ./

# Instalar las dependencias
RUN npm install

# Copiar todo el código del microservicio
COPY . .

# Comando por defecto para arrancar el servidor
CMD ["npm", "start"]