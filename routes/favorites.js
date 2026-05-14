// routes/favorites.js
const express = require('express');
const db      = require('../db/database');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/favorites  – logged-in user's favorites
router.get('/', protect, (req, res) => {
  const favorites = db.prepare(`
    SELECT p.*
    FROM favorites f
    JOIN properties p ON f.property_id = p.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  const data = favorites.map(p => ({
    ...p,
    amenities: (() => { try { return JSON.parse(p.amenities || '[]'); } catch { return []; } })()
  }));

  res.json({ success: true, data });
});

// POST /api/favorites  – add to favorites
router.post('/', protect, (req, res) => {
  const { property_id } = req.body;
  if (!property_id)
    return res.status(400).json({ success: false, message: 'property_id is required' });

  const property = db.prepare('SELECT id FROM properties WHERE id = ?').get(property_id);
  if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

  try {
    db.prepare('INSERT INTO favorites (user_id, property_id) VALUES (?, ?)').run(req.user.id, property_id);
    res.status(201).json({ success: true, message: 'Added to favorites' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, message: 'Already in favorites' });
    }
    throw err;
  }
});

// DELETE /api/favorites/:propertyId  – remove from favorites
router.delete('/:propertyId', protect, (req, res) => {
  const result = db.prepare(
    'DELETE FROM favorites WHERE user_id = ? AND property_id = ?'
  ).run(req.user.id, req.params.propertyId);

  if (result.changes === 0)
    return res.status(404).json({ success: false, message: 'Favorite not found' });

  res.json({ success: true, message: 'Removed from favorites' });
});

module.exports = router;
