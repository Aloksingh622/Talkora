const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');

const redisclient = require('./database/redis');
const AuthRouter = require('./routes/authRoutes');
const serviceAccount = require("../ServiceAccount.json");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', AuthRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Discord Clone Backend API is running' });
});



const Initializationconnection = async () => {
  try {
    await Promise.all([redisclient.connect()]);
    console.log("DB connected");
    app.listen(PORT, () => {
      console.log(" Server running on port", PORT);
    });
  }
  catch (err) {
    console.log("Error", err);
  }
}

Initializationconnection();
