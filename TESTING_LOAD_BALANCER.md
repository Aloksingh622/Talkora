# Load Balancer Testing Guide

## ✅ Configuration Changed

NGINX is now using **`least_conn`** (least connections) instead of `ip_hash`. This distributes connections more evenly across instances.

---

## 🧪 How to Test Load Distribution

### Method 1: Open Multiple Browser Windows

1. **Window 1**: Regular Chrome
   - Login as User 1 (e.g., alok)
   - Check terminal logs - note which instance (3001/3011/3012)

2. **Window 2**: Incognito Chrome (Ctrl+Shift+N)
   - Login as User 2 (e.g., Paarth)
   - Check terminal logs - should connect to different instance

3. **Window 3**: Different Browser (Firefox/Edge)
   - Login again
   - Check terminal logs

---

## 📊 What to Look For in Terminal Logs

Each instance terminal will show:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔌 NEW CONNECTION
   └─ Instance: INSTANCE-3001 (Port 3001)  ← LOOK AT THIS
   └─ Socket ID: abc123...
   └─ User: alok (ID: 1)
   └─ Time: 11:19:45 PM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Expected Result:**
- User 1 connects → INSTANCE-3001
- User 2 connects → INSTANCE-3011 (different!)
- User 3 connects → INSTANCE-3012 (different!)

---

## 🔄 Force Reconnection to Different Instance

1. **Refresh the page** (F5) - might connect to different instance
2. **Close tab and reopen** - new WebSocket connection
3. **Use different browser** - definitely new connection

---

## 🎯 Best Testing Method

**Use 2 Different Browsers:**
1. **Chrome** → Login as User 1
2. **Firefox** → Login as User 2

Each will likely connect to a different instance!

---

## 📝 Distribution Algorithm

- **`least_conn`**: Routes to instance with fewest active connections
- Better than round-robin for WebSocket (long-lived connections)
- If all instances have equal connections, picks next in rotation

---

## 🔙 Switch Back to Sticky Sessions (Production)

For production, switch back to `ip_hash` to prevent websocket reconnection issues:

```nginx
upstream realtime_backend {
    ip_hash;  # Change back from least_conn
    ...
}
```

Then reload: `docker exec discord-nginx-lb nginx -s reload`
