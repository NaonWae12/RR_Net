FROM node:20

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Clean and Install dependencies
RUN rm -rf node_modules && npm install --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Delete host node_modules again just in case COPY brought them in
RUN rm -rf node_modules/next && npm install --legacy-peer-deps

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build
RUN ./node_modules/.bin/next build

# Running stage
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
