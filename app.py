"""
Smart Real Estate Management System - Backend API
Flask + SQLite + JWT
"""
import os
import uuid
import hashlib
import sqlite3
import jwt as pyjwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, g

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DB_PATH     = os.path.join(BASE_DIR, "db", "real_estate.db")
UPLOAD_DIR  = os.path.join(BASE_DIR, "uploads")
SECRET_KEY  = os.environ.get("JWT_SECRET", "RE_SECRET_KEY_2026_CHANGE_IN_PROD")
JWT_EXPIRE_HOURS = 24
MAX_IMG_MB  = 5

ALLOWED_EXT = {"png", "jpg", "jpeg", "webp", "gif"}

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_IMG_MB * 1024 * 1024


# ─────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(exc=None):
    db = g.pop("db", None)
    if db:
        db.close()

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript("""
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            fullname    TEXT NOT NULL,
            email       TEXT NOT NULL UNIQUE,
            password    TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS properties (
            id          TEXT PRIMARY KEY,
            owner_id    TEXT NOT NULL,
            title       TEXT NOT NULL,
            developer   TEXT NOT NULL,
            project     TEXT NOT NULL,
            price       REAL NOT NULL,
            area        TEXT NOT NULL,
            bua         REAL NOT NULL,
            bedrooms    INTEGER NOT NULL,
            bathrooms   INTEGER NOT NULL,
            listing_type TEXT NOT NULL CHECK(listing_type IN ('Sale','Rent')),
            unit_type   TEXT NOT NULL,
            amenities   TEXT NOT NULL DEFAULT '[]',
            description TEXT,
            owner_phone TEXT,
            image_url   TEXT,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_props_type     ON properties(listing_type);
        CREATE INDEX IF NOT EXISTS idx_props_owner    ON properties(owner_id);
        CREATE INDEX IF NOT EXISTS idx_props_project  ON properties(project);
        """)
        conn.commit()
    print("✅ Database initialised at", DB_PATH)


# ─────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────
def hash_password(pw: str) -> str:
    salt = "RE_SALT_2026"
    return hashlib.sha256((pw + salt).encode()).hexdigest()

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

def make_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm="HS256")

def row_to_dict(row) -> dict:
    return dict(row) if row else None

def cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@app.after_request
def after_request(response):
    return cors_headers(response)

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        from flask import make_response
        resp = make_response("", 204)
        cors_headers(resp)
        return resp


# ─────────────────────────────────────────────
# JWT Auth decorator
# ─────────────────────────────────────────────
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.current_user_id = data["sub"]
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────
@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    fullname = (data.get("fullname") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not all([fullname, email, password]):
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    db = get_db()
    if db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
        return jsonify({"error": "Email already registered"}), 409

    uid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "INSERT INTO users (id, fullname, email, password, created_at) VALUES (?,?,?,?,?)",
        (uid, fullname, email, hash_password(password), now)
    )
    db.commit()
    token = make_token(uid, email)
    return jsonify({"message": "Account created", "token": token, "user": {"id": uid, "fullname": fullname, "email": email}}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    db   = get_db()
    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or user["password"] != hash_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = make_token(user["id"], user["email"])
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {"id": user["id"], "fullname": user["fullname"], "email": user["email"]}
    }), 200


@app.route("/api/auth/me", methods=["GET"])
@token_required
def me():
    db   = get_db()
    user = db.execute("SELECT id, fullname, email, created_at FROM users WHERE id=?",
                      (request.current_user_id,)).fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(row_to_dict(user)), 200


# ─────────────────────────────────────────────
# PROPERTY ROUTES
# ─────────────────────────────────────────────
def build_property_response(row: sqlite3.Row) -> dict:
    import json
    d = row_to_dict(row)
    try:
        d["amenities"] = json.loads(d.get("amenities") or "[]")
    except Exception:
        d["amenities"] = []
    return d


@app.route("/api/properties", methods=["GET"])
def get_properties():
    db = get_db()
    ltype    = request.args.get("type")          # Sale | Rent
    developer= request.args.get("developer")
    project  = request.args.get("project")
    unit_type= request.args.get("unit_type")
    search   = request.args.get("search")
    owner_id = request.args.get("owner_id")
    limit    = min(int(request.args.get("limit", 100)), 200)
    offset   = int(request.args.get("offset", 0))

    sql    = "SELECT * FROM properties WHERE 1=1"
    params = []

    if ltype:
        sql += " AND listing_type=?"; params.append(ltype)
    if developer:
        sql += " AND developer=?"; params.append(developer)
    if project:
        sql += " AND project=?"; params.append(project)
    if unit_type:
        sql += " AND unit_type=?"; params.append(unit_type)
    if owner_id:
        sql += " AND owner_id=?"; params.append(owner_id)
    if search:
        like = f"%{search}%"
        sql += " AND (title LIKE ? OR project LIKE ? OR area LIKE ? OR developer LIKE ?)"
        params += [like, like, like, like]

    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    rows = db.execute(sql, params).fetchall()
    return jsonify([build_property_response(r) for r in rows]), 200


@app.route("/api/properties/<prop_id>", methods=["GET"])
def get_property(prop_id):
    db  = get_db()
    row = db.execute("SELECT * FROM properties WHERE id=?", (prop_id,)).fetchone()
    if not row:
        return jsonify({"error": "Property not found"}), 404
    return jsonify(build_property_response(row)), 200


@app.route("/api/properties", methods=["POST"])
@token_required
def create_property():
    import json
    # Support both JSON and multipart/form-data
    if request.content_type and "multipart" in request.content_type:
        form      = request.form
        title     = (form.get("title") or "").strip()
        developer = (form.get("developer") or "").strip()
        project   = (form.get("project") or "").strip()
        price     = form.get("price")
        area      = (form.get("area") or "").strip()
        bua       = form.get("bua")
        bedrooms  = form.get("bedrooms")
        bathrooms = form.get("bathrooms")
        ltype     = form.get("listing_type") or form.get("type") or "Sale"
        unit_type = (form.get("unit_type") or "").strip()
        amenities = form.get("amenities") or "[]"
        desc      = (form.get("description") or "").strip()
        phone     = (form.get("owner_phone") or "").strip()
    else:
        data      = request.get_json(silent=True) or {}
        title     = (data.get("title") or "").strip()
        developer = (data.get("developer") or "").strip()
        project   = (data.get("project") or "").strip()
        price     = data.get("price")
        area      = (data.get("area") or "").strip()
        bua       = data.get("bua")
        bedrooms  = data.get("bedrooms")
        bathrooms = data.get("bathrooms")
        ltype     = data.get("listing_type") or data.get("type") or "Sale"
        unit_type = (data.get("unit_type") or "").strip()
        amenities = json.dumps(data.get("amenities") or [])
        desc      = (data.get("description") or "").strip()
        phone     = (data.get("owner_phone") or "").strip()

    # Validate required
    if not all([title, developer, project, price, area, bua, bedrooms, bathrooms, unit_type]):
        return jsonify({"error": "All required fields must be provided"}), 400

    try:
        price = float(price); bua = float(bua)
        bedrooms = int(bedrooms); bathrooms = int(bathrooms)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numeric values"}), 400

    if ltype not in ("Sale", "Rent"):
        ltype = "Sale"

    # Ensure amenities is valid JSON string
    if isinstance(amenities, str):
        try:
            json.loads(amenities)
        except Exception:
            amenities = "[]"

    # Handle image upload
    image_url = None
    if "image" in request.files:
        file = request.files["image"]
        if file and file.filename and allowed_file(file.filename):
            ext      = file.filename.rsplit(".", 1)[1].lower()
            filename = f"{uuid.uuid4()}.{ext}"
            file.save(os.path.join(UPLOAD_DIR, filename))
            image_url = f"/api/uploads/{filename}"

    prop_id = str(uuid.uuid4())
    now     = datetime.now(timezone.utc).isoformat()
    db      = get_db()
    db.execute("""
        INSERT INTO properties
          (id, owner_id, title, developer, project, price, area, bua,
           bedrooms, bathrooms, listing_type, unit_type, amenities,
           description, owner_phone, image_url, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (prop_id, request.current_user_id, title, developer, project,
          price, area, bua, bedrooms, bathrooms, ltype, unit_type,
          amenities, desc, phone, image_url, now))
    db.commit()

    row = db.execute("SELECT * FROM properties WHERE id=?", (prop_id,)).fetchone()
    return jsonify(build_property_response(row)), 201


@app.route("/api/properties/<prop_id>", methods=["PUT"])
@token_required
def update_property(prop_id):
    import json
    db  = get_db()
    row = db.execute("SELECT * FROM properties WHERE id=?", (prop_id,)).fetchone()
    if not row:
        return jsonify({"error": "Property not found"}), 404
    if row["owner_id"] != request.current_user_id:
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    fields = ["title","developer","project","price","area","bua",
              "bedrooms","bathrooms","listing_type","unit_type",
              "amenities","description","owner_phone","image_url"]
    updates, params = [], []
    for f in fields:
        if f in data:
            val = data[f]
            if f == "amenities" and isinstance(val, list):
                val = json.dumps(val)
            updates.append(f"{f}=?")
            params.append(val)
    if not updates:
        return jsonify({"error": "Nothing to update"}), 400
    params.append(prop_id)
    db.execute(f"UPDATE properties SET {', '.join(updates)} WHERE id=?", params)
    db.commit()
    row = db.execute("SELECT * FROM properties WHERE id=?", (prop_id,)).fetchone()
    return jsonify(build_property_response(row)), 200


@app.route("/api/properties/<prop_id>", methods=["DELETE"])
@token_required
def delete_property(prop_id):
    db  = get_db()
    row = db.execute("SELECT * FROM properties WHERE id=?", (prop_id,)).fetchone()
    if not row:
        return jsonify({"error": "Property not found"}), 404
    if row["owner_id"] != request.current_user_id:
        return jsonify({"error": "Forbidden"}), 403
    # Delete image file if exists
    if row["image_url"]:
        filename = row["image_url"].replace("/api/uploads/", "")
        img_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(img_path):
            os.remove(img_path)
    db.execute("DELETE FROM properties WHERE id=?", (prop_id,))
    db.commit()
    return jsonify({"message": "Property deleted"}), 200


# ─────────────────────────────────────────────
# IMAGE UPLOAD (standalone endpoint)
# ─────────────────────────────────────────────
@app.route("/api/upload-image", methods=["POST"])
@token_required
def upload_image():
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400
    file = request.files["image"]
    if not file or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400
    ext      = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    file.save(os.path.join(UPLOAD_DIR, filename))
    return jsonify({"image_url": f"/api/uploads/{filename}"}), 200


@app.route("/api/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)


# ─────────────────────────────────────────────
# MY PROPERTIES (owner dashboard)
# ─────────────────────────────────────────────
@app.route("/api/my-properties", methods=["GET"])
@token_required
def my_properties():
    db   = get_db()
    rows = db.execute(
        "SELECT * FROM properties WHERE owner_id=? ORDER BY created_at DESC",
        (request.current_user_id,)
    ).fetchall()
    return jsonify([build_property_response(r) for r in rows]), 200


# ─────────────────────────────────────────────
# STATS (optional nice-to-have)
# ─────────────────────────────────────────────
@app.route("/api/stats", methods=["GET"])
def stats():
    db = get_db()
    total     = db.execute("SELECT COUNT(*) FROM properties").fetchone()[0]
    for_sale  = db.execute("SELECT COUNT(*) FROM properties WHERE listing_type='Sale'").fetchone()[0]
    for_rent  = db.execute("SELECT COUNT(*) FROM properties WHERE listing_type='Rent'").fetchone()[0]
    total_users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    return jsonify({
        "total_properties": total,
        "for_sale": for_sale,
        "for_rent": for_rent,
        "total_users": total_users
    }), 200


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()}), 200



# ─────────────────────────────────────────────
# Serve Frontend (HTML / CSS / JS / images)
# ─────────────────────────────────────────────
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>")
def serve_frontend(filename):
    # Don't intercept /api/* routes
    if filename.startswith("api/"):
        from flask import abort
        abort(404)
    filepath = os.path.join(FRONTEND_DIR, filename)
    if os.path.isfile(filepath):
        return send_from_directory(FRONTEND_DIR, filename)
    # SPA fallback — serve index.html for unknown paths
    return send_from_directory(FRONTEND_DIR, "index.html")

# ─────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    print("🏠 Real Estate running on http://localhost:5000")
    print("📁 Place your HTML files inside the `frontend/` folder")
    app.run(host="0.0.0.0", port=5000, debug=True)
