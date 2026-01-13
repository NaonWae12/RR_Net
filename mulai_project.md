# Terminal 1: Start Docker

docker-compose up -d

# kill docker

docker-compose down

# Lihat semua container yang running

docker ps

# Lihat semua container (termasuk yang stopped)

docker ps -a

# Terminal 2: Start Go Backend

cd BE
.\run.ps1
