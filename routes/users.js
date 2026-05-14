// routes/users.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/users/my-properties  – properties added by logged-in user
// ─────────────────────────────────────────────
router.get('/my-properties', protect, (req, res) => {
  const properties = db.prepare(
    'SELECT * FROM properties WHERE owner_id = ? ORDER BY created_at DESC'
  ).all(req.user.id);

  const data = properties.map(p => ({
    ...p,
    amenities: (() => { try { return JSON.parse(p.amenities || '[]'); } catch { return []; } })()
  }));

  res.json({ success: true, data });
});

// ─────────────────────────────────────────────
// PUT /api/users/profile  – update own profile
// ─────────────────────────────────────────────
router.put('/profile', protect, (req, res) => {
  const { fullname, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (newPassword) {
    if (!currentPassword)
      return res.status(400).json({ success: false, message: 'Current password required' });
    if (!bcrypt.compareSync(currentPassword, user.password))
      return res.status(401).json({ success: false, message: 'Wrong current password' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  }

  if (fullname) {
    db.prepare('UPDATE users SET fullname = ? WHERE id = ?').run(fullname, req.user.id);
  }

  const updated = db.prepare('SELECT id, fullname, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, message: 'Profile updated', user: updated });
});

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// GET /api/users  – all users (admin)
router.get('/', protect, adminOnly, (req, res) => {
  const users = db.prepare(
    'SELECT id, fullname, email, role, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json({ success: true, data: users });
});

// DELETE /api/users/:id  – delete user (admin)
router.delete('/:id', protect, adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id)
    return res.status(400).json({ success: false, message: "Can't delete your own account" });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'User deleted' });
});

// PUT /api/users/:id/role  – change user role (admin)
router.put('/:id/role', protect, adminOnly, (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role))
    return res.status(400).json({ success: false, message: 'Role must be "user" or "admin"' });

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true, message: 'Role updated' });
});

// ─────────────────────────────────────────────
// GET /api/users/stats  – dashboard stats (admin)
// ─────────────────────────────────────────────
router.get('/stats', protect, adminOnly, (req, res) => {
  const totalProperties   = db.prepare("SELECT COUNT(*) as c FROM properties").get().c;
  const forSale           = db.prepare("SELECT COUNT(*) as c FROM properties WHERE listing_type='Sale'").get().c;
  const forRent           = db.prepare("SELECT COUNT(*) as c FROM properties WHERE listing_type='Rent'").get().c;
  const totalUsers        = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const totalInquiries    = db.prepare("SELECT COUNT(*) as c FROM inquiries").get().c;
  const recentProperties  = db.prepare("SELECT * FROM properties ORDER BY created_at DESC LIMIT 5").all();

  res.json({
    success: true,
    stats: { totalProperties, forSale, forRent, totalUsers, totalInquiries },
    recentProperties
  });
});

module.exports = router;
