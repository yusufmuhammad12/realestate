// routes/properties.js
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');
const { protect, adminOnly } = require('../middleware/auth');
const upload  = require('../middleware/upload');

const router = express.Router();

// ── util: parse amenities JSON safely ────────
const parseAmenities = (val) => {
  try { return JSON.parse(val || '[]'); } catch { return []; }
};

const formatProperty = (p) => ({
  ...p,
  amenities: parseAmenities(p.amenities),
});

// ─────────────────────────────────────────────
// GET /api/properties
// Query params: type, unit_type, developer, project, area, minPrice, maxPrice, bedrooms, page, limit
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  const {
    type, unit_type, developer, project,
    area, minPrice, maxPrice, bedrooms,
    page = 1, limit = 12, search
  } = req.query;

  let query  = 'SELECT * FROM properties WHERE 1=1';
  const params = [];

  if (type)      { query += ' AND listing_type = ?'; params.push(type); }
  if (unit_type) { query += ' AND unit_type = ?';    params.push(unit_type); }
  if (developer) { query += ' AND developer = ?';    params.push(developer); }
  if (project)   { query += ' AND project_name LIKE ?'; params.push(`%${project}%`); }
  if (area)      { query += ' AND area LIKE ?';      params.push(`%${area}%`); }
  if (minPrice)  { query += ' AND price >= ?';       params.push(Number(minPrice)); }
  if (maxPrice)  { query += ' AND price <= ?';       params.push(Number(maxPrice)); }
  if (bedrooms)  { query += ' AND bedrooms = ?';     params.push(Number(bedrooms)); }
  if (search)    {
    query += ' AND (title LIKE ? OR project_name LIKE ? OR area LIKE ? OR developer LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  // count total
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const { total } = db.prepare(countQuery).get(...params);

  // paginate
  const offset = (Number(page) - 1) * Number(limit);
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  const properties = db.prepare(query).all(...params).map(formatProperty);

  res.json({
    success: true,
    total,
    page:  Number(page),
    pages: Math.ceil(total / Number(limit)),
    data:  properties
  });
});

// ─────────────────────────────────────────────
// GET /api/properties/featured  (latest 6)
// ─────────────────────────────────────────────
router.get('/featured', (_req, res) => {
  const properties = db.prepare(
    "SELECT * FROM properties WHERE status = 'available' ORDER BY created_at DESC LIMIT 6"
  ).all().map(formatProperty);
  res.json({ success: true, data: properties });
});

// ─────────────────────────────────────────────
// GET /api/properties/:id
// ─────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ success: false, message: 'Property not found' });
  res.json({ success: true, data: formatProperty(property) });
});

// ─────────────────────────────────────────────
// POST /api/properties  (protected – any logged-in user)
// ─────────────────────────────────────────────
router.post('/', protect, upload.single('image'), (req, res) => {
  const {
    title, developer, project_name, price, area,
    bua, bedrooms, bathrooms, listing_type,
    unit_type, amenities, description, owner_phone
  } = req.body;

  // basic validation
  if (!title || !developer || !project_name || !price || !area || !bua
      || !bedrooms || !bathrooms || !listing_type || !unit_type) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const image_url = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  // amenities may come as JSON string or array
  let amenitiesJson = '[]';
  if (amenities) {
    try {
      amenitiesJson = Array.isArray(amenities)
        ? JSON.stringify(amenities)
        : JSON.stringify(JSON.parse(amenities));
    } catch {
      amenitiesJson = JSON.stringify(amenities.split(',').map(s => s.trim()));
    }
  }

  const result = db.prepare(`
    INSERT INTO properties
      (title, developer, project_name, price, area, bua, bedrooms, bathrooms,
       listing_type, unit_type, image_url, amenities, description, owner_phone, owner_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    title, developer, project_name, Number(price), area,
    Number(bua), Number(bedrooms), Number(bathrooms),
    listing_type, unit_type, image_url,
    amenitiesJson, description || '', owner_phone || '',
    req.user.id
  );

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, message: 'Property added', data: formatProperty(property) });
});

// ─────────────────────────────────────────────
// PUT /api/properties/:id  (owner or admin)
// ─────────────────────────────────────────────
router.put('/:id', protect, upload.single('image'), (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

  // only owner or admin can edit
  if (property.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized to edit this property' });
  }

  const {
    title, developer, project_name, price, area,
    bua, bedrooms, bathrooms, listing_type,
    unit_type, amenities, description, owner_phone, status
  } = req.body;

  // if new image uploaded, delete old one
  let image_url = property.image_url;
  if (req.file) {
    if (image_url) {
      const oldPath = path.join(__dirname, '..', image_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image_url = `/uploads/${req.file.filename}`;
  }

  let amenitiesJson = property.amenities;
  if (amenities !== undefined) {
    try {
      amenitiesJson = Array.isArray(amenities)
        ? JSON.stringify(amenities)
        : JSON.stringify(JSON.parse(amenities));
    } catch {
      amenitiesJson = JSON.stringify(amenities.split(',').map(s => s.trim()));
    }
  }

  db.prepare(`
    UPDATE properties SET
      title = ?, developer = ?, project_name = ?, price = ?, area = ?,
      bua = ?, bedrooms = ?, bathrooms = ?, listing_type = ?, unit_type = ?,
      image_url = ?, amenities = ?, description = ?, owner_phone = ?, status = ?
    WHERE id = ?
  `).run(
    title        ?? property.title,
    developer    ?? property.developer,
    project_name ?? property.project_name,
    price        ? Number(price) : property.price,
    area         ?? property.area,
    bua          ? Number(bua)   : property.bua,
    bedrooms     ? Number(bedrooms) : property.bedrooms,
    bathrooms    ? Number(bathrooms): property.bathrooms,
    listing_type ?? property.listing_type,
    unit_type    ?? property.unit_type,
    image_url,
    amenitiesJson,
    description  ?? property.description,
    owner_phone  ?? property.owner_phone,
    status       ?? property.status,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json({ success: true, message: 'Property updated', data: formatProperty(updated) });
});

// ─────────────────────────────────────────────
// DELETE /api/properties/:id  (owner or admin)
// ─────────────────────────────────────────────
router.delete('/:id', protect, (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

  if (property.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  // delete image file
  if (property.image_url) {
    const imgPath = path.join(__dirname, '..', property.image_url);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Property deleted' });
});

module.exports = router;
