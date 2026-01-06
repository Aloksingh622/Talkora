const express = require('express');
const cors = require('cors');

const app = express();
const   AuthRouter = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true
}))
app.use(cookieParser())
app.use(express.json());

app.use('/api/auth', AuthRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Discord Clone Backend API is running' });
});

module.exports = app;
