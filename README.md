# 🏠 Smart Real Estate Management System – Backend API

Built with **Node.js + Express + SQLite (better-sqlite3)**

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# Edit .env and set your JWT_SECRET

# 3. Start the server
npm start          # production
npm run dev        # development (auto-reload with nodemon)
```

Server runs on: `http://localhost:5000`

---

## 🔐 Default Admin Account
```
Email:    admin@realestate.com
Password: Admin@1234
```

---

## 📁 Project Structure
```
real-estate-backend/
├── server.js              ← Entry point
├── .env.example           ← Environment variables template
├── db/
│   └── database.js        ← SQLite setup & table creation
├── middleware/
│   ├── auth.js            ← JWT protect & adminOnly
│   └── upload.js          ← Multer image upload
├── routes/
│   ├── auth.js            ← /api/auth/*
│   ├── properties.js      ← /api/properties/*
│   ├── inquiries.js       ← /api/inquiries/*
│   ├── favorites.js       ← /api/favorites/*
│   └── users.js           ← /api/users/*
└── uploads/               ← Uploaded property images (auto-created)
```

---

## 📡 API Endpoints

### 🔐 Auth  `/api/auth`
| Method | Endpoint        | Auth     | Description         |
|--------|-----------------|----------|---------------------|
| POST   | `/signup`       | Public   | Register new user   |
| POST   | `/login`        | Public   | Login & get token   |
| GET    | `/me`           | 🔒 User  | Get current user    |

**Signup body:**
```json
{
  "fullname": "Youssef Salah",
  "email": "youssef@example.com",
  "password": "123456",
  "confirmPassword": "123456"
}
```

**Login body:**
```json
{
  "email": "youssef@example.com",
  "password": "123456"
}
```

**Response includes:**
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "user": { "id": 1, "fullname": "...", "email": "...", "role": "user" }
}
```

---

### 🏘️ Properties  `/api/properties`
| Method | Endpoint          | Auth         | Description              |
|--------|-------------------|--------------|--------------------------|
| GET    | `/`               | Public       | List all (with filters)  |
| GET    | `/featured`       | Public       | Latest 6 properties      |
| GET    | `/:id`            | Public       | Single property details  |
| POST   | `/`               | 🔒 User      | Add new property         |
| PUT    | `/:id`            | 🔒 Owner/Admin | Edit property           |
| DELETE | `/:id`            | 🔒 Owner/Admin | Delete property         |

**GET / Query params:**
```
?type=Sale          → listing_type (Sale | Rent)
?unit_type=Villa    → filter by unit type
?developer=Emaar    → filter by developer
?project=Marassi    → search in project name
?area=New Cairo     → search in area
?minPrice=500000    → minimum price
?maxPrice=2000000   → maximum price
?bedrooms=3         → number of bedrooms
?search=palm hills  → general search (title/project/area/developer)
?page=1&limit=12    → pagination
```

**POST / Form fields (multipart/form-data):**
```
title, developer, project_name, price, area,
bua, bedrooms, bathrooms, listing_type (Sale|Rent),
unit_type, description, owner_phone,
amenities (JSON array or comma-separated string),
image (file upload)
```

---

### 📩 Inquiries  `/api/inquiries`
| Method | Endpoint                    | Auth       | Description                  |
|--------|-----------------------------|------------|------------------------------|
| POST   | `/`                         | Public     | Submit a contact inquiry     |
| GET    | `/`                         | 🔒 Admin   | Get all inquiries            |
| GET    | `/property/:propertyId`     | 🔒 Owner/Admin | Inquiries for a property |
| DELETE | `/:id`                      | 🔒 Admin   | Delete an inquiry            |

**POST body:**
```json
{
  "property_id": 1,
  "name": "Ahmed",
  "email": "ahmed@example.com",
  "phone": "+201001234567",
  "message": "I'm interested in this property"
}
```

---

### ❤️ Favorites  `/api/favorites`
| Method | Endpoint        | Auth    | Description              |
|--------|-----------------|---------|--------------------------|
| GET    | `/`             | 🔒 User | Get user's favorites     |
| POST   | `/`             | 🔒 User | Add property to favorites|
| DELETE | `/:propertyId`  | 🔒 User | Remove from favorites    |

---

### 👤 Users  `/api/users`
| Method | Endpoint            | Auth       | Description              |
|--------|---------------------|------------|--------------------------|
| GET    | `/my-properties`    | 🔒 User    | My listed properties     |
| PUT    | `/profile`          | 🔒 User    | Update profile/password  |
| GET    | `/stats`            | 🔒 Admin   | Dashboard statistics     |
| GET    | `/`                 | 🔒 Admin   | All users                |
| DELETE | `/:id`              | 🔒 Admin   | Delete user              |
| PUT    | `/:id/role`         | 🔒 Admin   | Change user role         |

---

## 🔒 Using JWT Token

Add to request headers:
```
Authorization: Bearer <your_token_here>
```

---

## 🌐 Connecting Frontend

In your `script.js`, replace localStorage calls with API calls:

```js
const API = 'http://localhost:5000/api';

// Login example
async function handleLogin(event) {
  event.preventDefault();
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = 'index.html';
  } else {
    alert(data.message);
  }
}

// Get featured properties
async function renderFeaturedProperties() {
  const res  = await fetch(`${API}/properties/featured`);
  const data = await res.json();
  // render data.data array into #featured-grid
}

// Add property (with image)
async function addProperty(event) {
  event.preventDefault();
  const token = localStorage.getItem('token');
  const form = new FormData(document.getElementById('add-property-form'));
  const res = await fetch(`${API}/properties`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  const data = await res.json();
  alert(data.message);
}
```

---

## 🗄️ Database Tables

- **users** – id, fullname, email, password (hashed), role, created_at
- **properties** – id, title, developer, project_name, price, area, bua, bedrooms, bathrooms, listing_type, unit_type, image_url, amenities (JSON), description, owner_phone, owner_id, status, created_at
- **inquiries** – id, property_id, user_id, name, email, phone, message, created_at
- **favorites** – id, user_id, property_id, created_at

---

## ⚙️ Environment Variables

```env
PORT=5000
JWT_SECRET=your_super_secret_key_change_this_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```
