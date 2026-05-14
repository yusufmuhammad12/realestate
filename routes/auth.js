// routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/database');

const router = express.Router();

// ── helpers ──────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullname: user.fullname },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ─────────────────────────────────────────────
// POST /api/auth/signup
// ─────────────────────────────────────────────
router.post('/signup', (req, res) => {
  const { fullname, email, password, confirmPassword } = req.body;

  if (!fullname || !email || !password || !confirmPassword)
    return res.status(400).json({ success: false, message: 'All fields are required' });

  if (password !== confirmPassword)
    return res.status(400).json({ success: false, message: 'Passwords do not match' });

  if (password.length < 6)
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing)
    return res.status(409).json({ success: false, message: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)'
  ).run(fullname, email.toLowerCase(), hashed);

  const user = db.prepare('SELECT id, fullname, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);

  res.status(201).json({ success: true, message: 'Account created', token, user });
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user)
    return res.status(401).json({ success: false, message: 'Invalid email or password' });

  const match = bcrypt.compareSync(password, user.password);
  if (!match)
    return res.status(401).json({ success: false, message: 'Invalid email or password' });

  const token = signToken(user);
  const { password: _pw, ...safeUser } = user;

  res.json({ success: true, message: 'Login successful', token, user: safeUser });
});

// ─────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────
const { protect } = require('../middleware/auth');

router.get('/me', protect, (req, res) => {
  const user = db.prepare('SELECT id, fullname, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, user });
});

module.exports = router;
