# Load Balancing for WebSocket Services

## 🎯 Quick Answer

**YES, you need a load balancer for 10 Realtime instances!**

But not just any load balancer - WebSocket connections require **special configuration**.

---

## 🔄 Load Balancing Strategy

### **Architecture with Load Balancer:**

```
Frontend (100K Users)
     │
     │ ws://your-domain.com
     ▼
┌─────────────────────┐
│  LOAD BALANCER      │
│  (Nginx/HAProxy)    │
│                     │
│  • Port: 3001       │
│  • Protocol: WS     │
│  • Strategy: IP Hash│
└──────────┬──────────┘
           │
    ┌──────┴───────────────┬────────────┬────────────┐
    │                      │            │            │
    ▼                      ▼            ▼            ▼
┌─────────┐           ┌─────────┐  ┌─────────┐  ┌─────────┐
│Realtime │           │Realtime │  │Realtime │  │Realtime │
│Instance1│           │Instance2│  │Instance3│  │Instance10│
│Port 3001│           │Port 3011│  │Port 3021│  │Port 3091│
│10K users│           │10K users│  │10K users│  │10K users│
└────┬────┘           └────┬────┘  └────┬────┘  └────┬────┘
     │                     │            │            │
     └─────────────────────┴────────────┴────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │ Redis Pub/Sub │
                   │ (for messages)│
                   └───────────────┘
```

---

## ⚠️ WebSocket Load Balancing Requirements

### **Problem: WebSockets are NOT like HTTP!**

```
HTTP Request/Response (Stateless):
├─ Client sends request
├─ Load balancer forwards to ANY backend
├─ Backend responds
└─ Connection closed

WebSocket (Stateful):
├─ Client initiates connection
├─ Connection STAYS OPEN (persistent!)
├─ Bi-directional messages
└─ Must connect to SAME backend for duration!
```

**Key Requirement:** Once a user connects to Instance 1, all their messages **MUST** go to Instance 1 until they disconnect!

---

## 🛠️ Load Balancer Options

### **Option 1: Nginx (Recommended)** ⭐

**Why Nginx:**
- ✅ Built-in WebSocket support
- ✅ IP hash for sticky sessions
- ✅ High performance (100K+ connections)
- ✅ Free and open-source
- ✅ Easy configuration

**Configuration:**

```nginx
# /etc/nginx/nginx.conf

upstream realtime_backend {
    # IP Hash ensures same client → same backend
    ip_hash;
    
    # List all Realtime instances
    server localhost:3001 max_fails=3 fail_timeout=30s;
    server localhost:3011 max_fails=3 fail_timeout=30s;
    server localhost:3021 max_fails=3 fail_timeout=30s;
    server localhost:3031 max_fails=3 fail_timeout=30s;
    server localhost:3041 max_fails=3 fail_timeout=30s;
    server localhost:3051 max_fails=3 fail_timeout=30s;
    server localhost:3061 max_fails=3 fail_timeout=30s;
    server localhost:3071 max_fails=3 fail_timeout=30s;
    server localhost:3081 max_fails=3 fail_timeout=30s;
    server localhost:3091 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        # WebSocket upgrade headers
        proxy_pass http://realtime_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-lived connections
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
```

**Install & Run:**
```bash
# Install Nginx
sudo apt-get install nginx

# Copy config
sudo nano /etc/nginx/nginx.conf

# Test config
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

### **Option 2: HAProxy** (Alternative)

**Configuration:**

```haproxy
# /etc/haproxy/haproxy.cfg

global
    log /dev/log local0
    maxconn 100000

defaults
    log global
    mode http
    timeout connect 5000ms
    timeout client 7d
    timeout server 7d

frontend websocket_frontend
    bind *:80
    default_backend realtime_backend

backend realtime_backend
    balance source  # IP-based sticky sessions
    
    # Health checks
    option httpchk GET /health
    
    # Realtime instances
    server realtime1 localhost:3001 check
    server realtime2 localhost:3011 check
    server realtime3 localhost:3021 check
    server realtime4 localhost:3031 check
    server realtime5 localhost:3041 check
    server realtime6 localhost:3051 check
    server realtime7 localhost:3061 check
    server realtime8 localhost:3071 check
    server realtime9 localhost:3081 check
    server realtime10 localhost:3091 check
```

---

### **Option 3: Docker + Traefik** (Modern)

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.websocket.address=:80"
    ports:
      - "80:80"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  realtime1:
    build: ./backend-realtime
    environment:
      - PORT=3001
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.realtime.rule=Host(`your-domain.com`)"
      - "traefik.http.services.realtime.loadbalancer.sticky.cookie=true"
    
  realtime2:
    build: ./backend-realtime
    environment:
      - PORT=3001
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.realtime.rule=Host(`your-domain.com`)"
      - "traefik.http.services.realtime.loadbalancer.sticky.cookie=true"
  
  # ... realtime3-10 (similar)
```

---

## 🔑 Sticky Sessions Strategies

### **1. IP Hash (Nginx `ip_hash`)**

**How it works:**
```
User IP: 192.168.1.50
Hash: MD5(192.168.1.50) = abc123...
Backend: abc123 % 10 = Instance 3
→ Always routes to Instance 3
```

**Pros:**
- ✅ Simple configuration
- ✅ Works without cookies
- ✅ No client-side changes

**Cons:**
- ⚠️ Users behind NAT (same IP) → same instance (uneven load)
- ⚠️ IP change = new instance (reconnect)

**Best for:** Simple deployments, private networks

---

### **2. Cookie-based Sticky Sessions**

**How it works:**
```
1. Load balancer assigns cookie: backend_id=instance3
2. Client stores cookie
3. Future requests include cookie
4. Load balancer routes to instance3
```

**Nginx Config:**
```nginx
upstream realtime_backend {
    server localhost:3001;
    server localhost:3011;
    # ... other servers
    
    sticky cookie backend_id expires=1h domain=.your-domain.com path=/;
}
```

**Pros:**
- ✅ Even load distribution
- ✅ Works with NAT/proxies
- ✅ Survives IP changes

**Cons:**
- ⚠️ Requires Nginx Plus (paid) or 3rd party module
- ⚠️ Client must support cookies

**Best for:** Production environments

---

### **3. Source IP + Port (HAProxy `source`)**

**HAProxy Config:**
```haproxy
balance source
hash-type consistent  # Better distribution
```

**Pros:**
- ✅ Better than simple IP hash
- ✅ More even distribution

**Cons:**
- ⚠️ Still affected by NAT

---

## 🚀 Recommended Setup (Step-by-Step)

### **Phase 1: Development (Single Server)**

```
No load balancer needed!
Just run multiple instances on different ports:

Terminal 1: PORT=3001 npm start (Realtime 1)
Terminal 2: PORT=3011 npm start (Realtime 2)

Frontend connects to: ws://localhost:3001
```

---

### **Phase 2: Staging (Nginx on Same Server)**

```bash
# 1. Install Nginx
sudo apt-get install nginx

# 2. Start 10 Realtime instances (use PM2)
npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'realtime-1',
      script: './src/server.js',
      cwd: './backend-realtime',
      env: { PORT: 3001 }
    },
    {
      name: 'realtime-2',
      script: './src/server.js',
      cwd: './backend-realtime',
      env: { PORT: 3011 }
    },
    // ... realtime-3 to realtime-10
  ]
};

pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 3. Configure Nginx (see config above)
sudo nano /etc/nginx/nginx.conf

# 4. Restart Nginx
sudo systemctl restart nginx

# 5. Update Frontend
// Before: ws://localhost:3001
// After:  ws://your-domain.com (Nginx routes to instances)
```

---

### **Phase 3: Production (Multiple Servers)**

```
Server 1 (Nginx Load Balancer):
├─ Nginx on port 80
└─ Routes to 10 backend servers

Server 2-11 (Realtime Instances):
├─ Each runs 1 Realtime instance
├─ Ports: 3001 (all use same port, different servers)
└─ 10K users each

Nginx Config:
upstream realtime_backend {
    ip_hash;
    server 192.168.1.10:3001;  # Server 2
    server 192.168.1.11:3001;  # Server 3
    server 192.168.1.12:3001;  # Server 4
    # ... servers 5-11
}
```

---

## 🔍 How Redis Pub/Sub Works with Load Balancer

### **Question: If users are on different instances, how do they receive messages?**

**Answer: Redis Adapter handles this automatically!**

```
User A on Instance 1 sends message "Hello!"
     │
     ▼
┌──────────────┐
│ Instance 1   │ (User A connected here)
│ Kafka.send() │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Kafka     │
└──────┬───────┘
       │
       ▼
┌────────────────┐
│ Realtime       │
│ Consumer       │
│ Redis.publish()│
└────────┬───────┘
         │
         ▼
┌────────────────────────────────┐
│       Redis Pub/Sub            │
│ Channel: socket.io#/#channel:1#│
└────┬──────────────┬────────────┘
     │              │
     ▼              ▼
┌──────────┐  ┌──────────┐
│Instance 1│  │Instance 2│ (User B connected here)
│(User A)  │  │(User B)  │
└────┬─────┘  └────┬─────┘
     │              │
     ▼              ▼
User A sees     User B sees
message!        message!
```

**All instances subscribe to Redis, so all receive the message!** ✅

---

## 📊 PM2 Ecosystem Config (Complete)

**ecosystem.config.js:**

```javascript
module.exports = {
  apps: [
    // Realtime Services (10 instances)
    ...Array.from({ length: 10 }, (_, i) => ({
      name: `realtime-${i + 1}`,
      script: './src/server.js',
      cwd: './backend-realtime',
      instances: 1,
      env: {
        PORT: 3001 + (i * 10),
        NODE_ENV: 'production',
        REDIS_URL: 'redis://localhost:6379',
        KAFKA_BROKERS: 'localhost:9092'
      }
    })),
    
    // API Services (5 instances)
    ...Array.from({ length: 5 }, (_, i) => ({
      name: `api-${i + 1}`,
      script: './src/server.js',
      cwd: './backend-api',
      instances: 1,
      env: {
        PORT: 3002 + i,
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL
      }
    })),
    
    // Worker Services (3 instances)
    ...Array.from({ length: 3 }, (_, i) => ({
      name: `worker-${i + 1}`,
      script: './src/server.js',
      cwd: './backend-worker',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        REDIS_URL: 'redis://localhost:6379'
      }
    }))
  ]
};
```

**Usage:**
```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs realtime-1
pm2 monit
```

---

## 🎯 Quick Setup Guide

### **1. Install Dependencies**

```bash
# Install Nginx
sudo apt-get update
sudo apt-get install nginx

# Install PM2
npm install -g pm2
```

---

### **2. Create Nginx Config**

```bash
sudo nano /etc/nginx/sites-available/websocket
```

**Content:**
```nginx
upstream realtime {
    ip_hash;
    server localhost:3001;
    server localhost:3011;
    server localhost:3021;
    server localhost:3031;
    server localhost:3041;
    server localhost:3051;
    server localhost:3061;
    server localhost:3071;
    server localhost:3081;
    server localhost:3091;
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://realtime;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

**Enable:**
```bash
sudo ln -s /etc/nginx/sites-available/websocket /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### **3. Start Realtime Instances**

```bash
cd backend-realtime
pm2 start ecosystem.config.js
pm2 save
```

---

### **4. Update Frontend**

```javascript
// frontend/src/socket.js

// Before:
const socket = io('http://localhost:3001');

// After (with Nginx):
const socket = io('http://localhost');  // Nginx on port 80
// or
const socket = io('https://your-domain.com');  // Production
```

---

## 🎯 Final Answer

**Do you need a load balancer for multiple Realtime instances?**

✅ **YES, absolutely!**

**Recommended Setup:**
1. **Load Balancer:** Nginx with `ip_hash`
2. **Process Manager:** PM2 (10 Realtime instances)
3. **Sticky Sessions:** IP-based (built into Nginx)
4. **Inter-instance Communication:** Redis Pub/Sub (already have it!)

**Config Time:** ~30 minutes  
**Complexity:** Low (Nginx is simple)  
**Cost:** Free (Nginx is open-source)

Start with Nginx on **same server**, then scale to multiple servers when needed! 🚀
