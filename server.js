// server.js  –  Smart Real Estate Management System API
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ─────────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────────
app.use(cors({
  origin: '*',           // in production: replace with your frontend domain
  methods: ['GET','POST','PUT','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
//  INIT DATABASE  (runs CREATE TABLE IF NOT EXISTS + seed)
// ─────────────────────────────────────────────
require('./db/database');

// ─────────────────────────────────────────────
//  ROUTES
// ─────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/properties',  require('./routes/properties'));
app.use('/api/inquiries',   require('./routes/inquiries'));
app.use('/api/favorites',   require('./routes/favorites'));
app.use('/api/users',       require('./routes/users'));

// Health check
app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'Real Estate API is running 🏠', time: new Date() })
);

// ─────────────────────────────────────────────
//  404 & ERROR HANDLER
// ─────────────────────────────────────────────
app.use((_req, res) =>
  res.status(404).json({ success: false, message: 'Route not found' })
);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('❌  Error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

// ─────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀  Server running on http://localhost:${PORT}`);
  console.log(`📋  API docs → see README.md\n`);
});
