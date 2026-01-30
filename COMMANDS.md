# 🚀 Quick Command Reference

## 📦 **NGINX Load Balancer**

### Start NGINX
```bash
cd docker-nginx
docker-compose up -d
```

### Stop NGINX
```bash
cd docker-nginx
docker-compose down
```

### Restart NGINX
```bash
docker-compose restart
```

### View Logs
```bash
docker logs -f discord-nginx-lb
```

### Reload Config (No Downtime)
```bash
docker exec discord-nginx-lb nginx -s reload
```

### Check Status
```bash
docker ps | findstr nginx
curl http://localhost:3000/health
```

---

## 🔥 **Backend Realtime Instances**

### Start All Instances (One Command)
```bash
.\start-all-instances.bat
```

### Start Individual Instances
```bash
# Instance 1 (Port 3001)
cd backend-realtime
.\start-instance-1.bat

# Instance 2 (Port 3011)
.\start-instance-2.bat

# Instance 3 (Port 3012)
.\start-instance-3.bat
```

### Stop Instance
Press `Ctrl+C` in the terminal window

---

## 🗂️ **Full System Startup**

### 1. Start Kafka
```bash
cd docker-kafka
docker-compose up -d
```

### 2. Start NGINX
```bash
cd docker-nginx
docker-compose up -d
```

### 3. Start Backend Services
```bash
# API Service
cd backend-api
nodemon

# Consumer Service
cd backend-consumer
nodemon
```

### 4. Start Realtime Instances
```bash
.\start-all-instances.bat
```

### 5. Start Frontend
```bash
cd frontend
npm run dev
```

---

## 🛑 **Full System Shutdown**

```bash
# Stop NGINX
cd docker-nginx
docker-compose down

# Stop Kafka
cd docker-kafka
docker-compose down

# Press Ctrl+C in all other terminal windows
```

---

## 📊 **Monitoring**

### View All Running Services
```bash
docker ps
```

### Check Realtime Connections
```bash
# Should show 3 instances
netstat -ano | findstr ":3001 :3011 :3012"
```

### Test Load Balancer
```bash
curl http://localhost:3000/health
```

---

## ⚡ **Quick Tools**

- **NGINX Control**: Run `nginx-control.bat` for interactive menu
- **Start All Instances**: Run `start-all-instances.bat`
- **Individual Instances**: Use `start-instance-X.bat` files

---

## 🔧 **Troubleshooting**

### Port Already in Use
```bash
# Find what's using the port
netstat -ano | findstr ":3001"

# Kill the process
taskkill /PID <pid> /F
```

### NGINX Not Starting
```bash
# Check logs
docker logs discord-nginx-lb

# Verify config
docker exec discord-nginx-lb nginx -t
```

### Instance Won't Connect
```bash
# Check Redis is running
redis-cli ping

# Check Kafka is running
docker ps | findstr kafka
```
