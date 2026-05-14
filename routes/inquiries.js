// routes/inquiries.js
const express = require('express');
const db      = require('../db/database');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────
// POST /api/inquiries  (anyone can submit)
// ─────────────────────────────────────────────
router.post('/', (req, res) => {
  const { property_id, name, email, phone, message } = req.body;

  if (!property_id || !name || !email || !message)
    return res.status(400).json({ success: false, message: 'property_id, name, email, message are required' });

  const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(property_id);
  if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

  const result = db.prepare(`
    INSERT INTO inquiries (property_id, name, email, phone, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(property_id, name, email, phone || '', message);

  res.status(201).json({ success: true, message: 'Inquiry submitted', id: result.lastInsertRowid });
});

// ─────────────────────────────────────────────
// GET /api/inquiries  (admin only – all inquiries)
// ─────────────────────────────────────────────
router.get('/', protect, adminOnly, (req, res) => {
  const inquiries = db.prepare(`
    SELECT i.*, p.title as property_title
    FROM inquiries i
    LEFT JOIN properties p ON i.property_id = p.id
    ORDER BY i.created_at DESC
  `).all();
  res.json({ success: true, data: inquiries });
});

// ─────────────────────────────────────────────
// GET /api/inquiries/property/:propertyId  (owner or admin)
// ─────────────────────────────────────────────
router.get('/property/:propertyId', protect, (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.propertyId);
  if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

  if (property.owner_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Not authorized' });

  const inquiries = db.prepare(
    'SELECT * FROM inquiries WHERE property_id = ? ORDER BY created_at DESC'
  ).all(req.params.propertyId);

  res.json({ success: true, data: inquiries });
});

// ─────────────────────────────────────────────
// DELETE /api/inquiries/:id  (admin only)
// ─────────────────────────────────────────────
router.delete('/:id', protect, adminOnly, (req, res) => {
  const inquiry = db.prepare('SELECT id FROM inquiries WHERE id = ?').get(req.params.id);
  if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found' });

  db.prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Inquiry deleted' });
});

module.exports = router;
