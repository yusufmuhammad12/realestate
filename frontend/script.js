/**
 * Real Estate Management System
 * Frontend ↔ Backend connector script
 * Replaces localStorage with real API calls
 */

// ─────────────────────────────────────────────
// CONFIG — change this if you deploy the backend
// ─────────────────────────────────────────────
const API_BASE = "/api";  // Same server — no need to change this

// ─────────────────────────────────────────────
// TOKEN helpers
// ─────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("re_token");
}
function setToken(token) {
  localStorage.setItem("re_token", token);
}
function clearToken() {
  localStorage.removeItem("re_token");
  localStorage.removeItem("re_user");
}
function setUser(user) {
  localStorage.setItem("re_user", JSON.stringify(user));
}
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("re_user"));
  } catch {
    return null;
  }
}
function isLoggedIn() {
  return !!getToken();
}

// ─────────────────────────────────────────────
// API helper
// ─────────────────────────────────────────────
async function apiCall(method, endpoint, body = null, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isFormData) headers["Content-Type"] = "application/json";

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    const json = await res.json();
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    return { ok: false, status: 0, data: { error: "Cannot connect to server. Is the backend running?" } };
  }
}

// ─────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────
function showToast(message, type = "success") {
  const existing = document.querySelector(".re-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `re-toast re-toast--${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:${type === "success" ? "#2e7d32" : type === "error" ? "#c62828" : "#1565c0"};
    color:#fff; padding:14px 22px; border-radius:10px;
    font-size:14px; font-family:inherit; box-shadow:0 4px 20px rgba(0,0,0,.25);
    max-width:320px; line-height:1.4; animation: slideIn .3s ease;
  `;
  document.head.insertAdjacentHTML("beforeend",
    `<style>@keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}</style>`
  );
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─────────────────────────────────────────────
// AUTH — Signup
// ─────────────────────────────────────────────
async function handleSignup(event) {
  event.preventDefault();

  const fullname  = document.getElementById("fullname")?.value.trim();
  const email     = document.getElementById("email")?.value.trim();
  const password  = document.getElementById("password")?.value;
  const confirm   = document.getElementById("confirm-password")?.value;

  if (password !== confirm) {
    showToast("Passwords do not match", "error");
    return;
  }

  const btn = event.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Creating account…"; }

  const { ok, data } = await apiCall("POST", "/auth/signup", { fullname, email, password });

  if (ok) {
    setToken(data.token);
    setUser(data.user);
    showToast("Account created! Redirecting…", "success");
    setTimeout(() => (window.location.href = "index.html"), 1200);
  } else {
    showToast(data.error || "Signup failed", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Sign Up"; }
  }
}

// ─────────────────────────────────────────────
// AUTH — Login
// ─────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();

  const email    = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  const btn = event.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Logging in…"; }

  const { ok, data } = await apiCall("POST", "/auth/login", { email, password });

  if (ok) {
    setToken(data.token);
    setUser(data.user);
    showToast("Welcome back! Redirecting…", "success");
    setTimeout(() => (window.location.href = "index.html"), 1200);
  } else {
    showToast(data.error || "Login failed", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Login"; }
  }
}

// ─────────────────────────────────────────────
// AUTH — Logout
// ─────────────────────────────────────────────
function handleLogout() {
  clearToken();
  showToast("Logged out successfully", "success");
  setTimeout(() => (window.location.href = "login.html"), 1000);
}

// ─────────────────────────────────────────────
// Navbar: show logout button if logged in
// ─────────────────────────────────────────────
function updateNavbar() {
  const loginLink = document.querySelector('a[href="login.html"].btn-outline');
  if (!loginLink) return;

  if (isLoggedIn()) {
    const user = getUser();
    const li = loginLink.closest("li");
    if (li) {
      li.innerHTML = `
        <span style="color:var(--primary,#4f46e5);font-weight:600;margin-right:8px;">
          👤 ${user?.fullname?.split(" ")[0] || "Account"}
        </span>
        <a href="#" class="btn btn-outline" onclick="handleLogout()">Logout</a>
      `;
    }
  }
}

// ─────────────────────────────────────────────
// PROPERTY — Add (dashboard form)
// ─────────────────────────────────────────────
async function addProperty(event) {
  event.preventDefault();

  if (!isLoggedIn()) {
    showToast("Please login first", "error");
    setTimeout(() => (window.location.href = "login.html"), 1200);
    return;
  }

  const formData = new FormData();
  formData.append("title",        document.getElementById("prop-title")?.value.trim());
  formData.append("developer",    document.getElementById("prop-developer")?.value.trim());
  formData.append("project",      document.getElementById("prop-project")?.value.trim());
  formData.append("price",        document.getElementById("prop-price")?.value);
  formData.append("area",         document.getElementById("prop-area")?.value.trim());
  formData.append("bua",          document.getElementById("prop-bua")?.value);
  formData.append("bedrooms",     document.getElementById("prop-rooms")?.value);
  formData.append("bathrooms",    document.getElementById("prop-bathrooms")?.value);
  formData.append("listing_type", document.getElementById("prop-type")?.value || "Sale");
  formData.append("unit_type",    document.getElementById("prop-unit-type")?.value.trim());
  formData.append("description",  document.getElementById("prop-desc")?.value.trim());
  formData.append("owner_phone",  document.getElementById("owner-phone")?.value.trim());

  // Amenities checkboxes
  const checked = [...document.querySelectorAll(".prop-amenity:checked")].map(cb => cb.value);
  formData.append("amenities", JSON.stringify(checked));

  // Image file
  const imageFile = document.getElementById("prop-image-file")?.files[0];
  if (imageFile) formData.append("image", imageFile);

  const btn = event.target.querySelector("button[type=submit]");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  const { ok, data } = await apiCall("POST", "/properties", formData, true);

  if (ok) {
    showToast("Property added successfully! 🏠", "success");
    event.target.reset();
    setTimeout(() => (window.location.href = "buy.html"), 1500);
  } else {
    showToast(data.error || "Failed to add property", "error");
  }

  if (btn) { btn.disabled = false; btn.textContent = "Add Property"; }
}

// ─────────────────────────────────────────────
// PROPERTY CARD renderer
// ─────────────────────────────────────────────
function createPropertyCard(prop) {
  const imageUrl = prop.image_url
    ? `${API_BASE.replace("/api", "")}${prop.image_url}`
    : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80";

  const price = Number(prop.price).toLocaleString("en-US");

  return `
    <div class="property-card" onclick="viewProperty('${prop.id}')" style="cursor:pointer;">
      <div class="property-image" style="background:url('${imageUrl}') center/cover no-repeat;height:200px;border-radius:12px 12px 0 0;"></div>
      <div class="property-info" style="padding:16px;">
        <div class="property-type-badge">${prop.listing_type === "Rent" ? "For Rent" : "For Sale"}</div>
        <h3 class="property-title">${prop.title}</h3>
        <div class="property-meta">
          <span>📍 ${prop.area}</span>
          <span>🏢 ${prop.developer}</span>
        </div>
        <div class="property-details">
          <span>🛏 ${prop.bedrooms} Beds</span>
          <span>🚿 ${prop.bathrooms} Baths</span>
          <span>📐 ${prop.bua} m²</span>
        </div>
        <div class="property-price">$${price}</div>
        <div class="property-project">${prop.project} · ${prop.unit_type}</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────
// View property → redirect to details page
// ─────────────────────────────────────────────
function viewProperty(id) {
  window.location.href = `details.html?id=${id}`;
}

// ─────────────────────────────────────────────
// INDEX page — Featured properties
// ─────────────────────────────────────────────
async function renderFeaturedProperties() {
  const grid = document.getElementById("featured-grid");
  if (!grid) return;
  grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>Loading properties…</p>";

  const { ok, data } = await apiCall("GET", "/properties?limit=6");
  if (!ok || !Array.isArray(data) || data.length === 0) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>No properties found yet.</p>";
    return;
  }
  grid.innerHTML = data.map(createPropertyCard).join("");
}

// ─────────────────────────────────────────────
// BUY / RENT pages — All listings with filters
// ─────────────────────────────────────────────
async function renderAllListings(type) {
  const grid = document.getElementById("listings-grid");
  if (!grid) return;
  grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>Loading…</p>";

  const developer = document.getElementById("filter-developer")?.value || "";
  const project   = document.getElementById("filter-project")?.value || "";
  const unitType  = document.getElementById("filter-unit")?.value || "";

  let qs = `?type=${type}`;
  if (developer) qs += `&developer=${encodeURIComponent(developer)}`;
  if (project)   qs += `&project=${encodeURIComponent(project)}`;
  if (unitType)  qs += `&unit_type=${encodeURIComponent(unitType)}`;

  // Smart search from homepage
  const smartSearch = sessionStorage.getItem("re_search");
  if (smartSearch) {
    qs += `&search=${encodeURIComponent(smartSearch)}`;
    sessionStorage.removeItem("re_search");
  }

  const { ok, data } = await apiCall("GET", `/properties${qs}`);
  if (!ok || !Array.isArray(data) || data.length === 0) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>No properties found matching your filters.</p>";
    return;
  }
  grid.innerHTML = data.map(createPropertyCard).join("");
}

function filterListings(type) {
  renderAllListings(type);
}

// ─────────────────────────────────────────────
// NEW PROJECTS page
// ─────────────────────────────────────────────
async function renderNewProjects() {
  const grid = document.getElementById("projects-grid") || document.getElementById("listings-grid");
  if (!grid) return;
  grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>Loading projects…</p>";

  const { ok, data } = await apiCall("GET", "/properties?limit=50");
  if (!ok || !Array.isArray(data) || data.length === 0) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>No projects found yet.</p>";
    return;
  }

  // Group by project name
  const projectMap = {};
  data.forEach(p => {
    if (!projectMap[p.project]) {
      projectMap[p.project] = { ...p, count: 1 };
    } else {
      projectMap[p.project].count++;
    }
  });

  grid.innerHTML = Object.values(projectMap).map(p => `
    <div class="property-card" style="cursor:pointer;" onclick="viewProject('${encodeURIComponent(p.project)}')">
      <div class="property-image" style="background:url('${p.image_url ? API_BASE.replace("/api","") + p.image_url : "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80"}') center/cover;height:200px;border-radius:12px 12px 0 0;"></div>
      <div class="property-info" style="padding:16px;">
        <h3 class="property-title">${p.project}</h3>
        <div class="property-meta">
          <span>🏢 ${p.developer}</span>
          <span>📍 ${p.area}</span>
        </div>
        <div class="property-project">${p.count} unit${p.count > 1 ? "s" : ""} available</div>
        <div class="property-price">From $${Number(p.price).toLocaleString("en-US")}</div>
      </div>
    </div>`).join("");
}

function viewProject(projectName) {
  sessionStorage.setItem("re_search", decodeURIComponent(projectName));
  window.location.href = "buy.html";
}

// ─────────────────────────────────────────────
// DETAILS page
// ─────────────────────────────────────────────
async function loadPropertyDetails() {
  const container = document.getElementById("details-container");
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const id     = params.get("id");
  if (!id) {
    container.innerHTML = "<p style='text-align:center;padding:60px;color:#888;'>No property selected.</p>";
    return;
  }

  container.innerHTML = "<p style='text-align:center;padding:60px;color:#888;'>Loading details…</p>";

  const { ok, data } = await apiCall("GET", `/properties/${id}`);
  if (!ok) {
    container.innerHTML = `<p style='text-align:center;padding:60px;color:#c00;'>${data.error || "Property not found"}</p>`;
    return;
  }

  const p = data;
  const price     = Number(p.price).toLocaleString("en-US");
  const imageUrl  = p.image_url
    ? `${API_BASE.replace("/api", "")}${p.image_url}`
    : "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80";
  const amenitiesList = Array.isArray(p.amenities) && p.amenities.length
    ? p.amenities.map(a => `<span class="amenity-tag">${a}</span>`).join("")
    : "<span style='color:#888;'>None listed</span>";

  container.innerHTML = `
    <div class="detail-page" style="max-width:900px;margin:0 auto;padding:20px;">
      <button onclick="history.back()" class="btn btn-outline" style="margin-bottom:20px;">← Back</button>
      <div class="detail-image" style="width:100%;height:400px;background:url('${imageUrl}') center/cover;border-radius:16px;margin-bottom:30px;"></div>
      <div class="detail-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
        <div>
          <h1 style="margin:0 0 8px;">${p.title}</h1>
          <p style="color:#666;margin:0;">📍 ${p.area} · 🏢 ${p.developer} · ${p.project}</p>
        </div>
        <div class="property-price" style="font-size:1.8rem;">$${price}</div>
      </div>
      <div class="detail-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin:24px 0;padding:20px;background:#f9f9f9;border-radius:12px;">
        <div style="text-align:center;"><div style="font-size:1.4rem;">🛏</div><strong>${p.bedrooms}</strong><br><small>Bedrooms</small></div>
        <div style="text-align:center;"><div style="font-size:1.4rem;">🚿</div><strong>${p.bathrooms}</strong><br><small>Bathrooms</small></div>
        <div style="text-align:center;"><div style="font-size:1.4rem;">📐</div><strong>${p.bua} m²</strong><br><small>BUA</small></div>
        <div style="text-align:center;"><div style="font-size:1.4rem;">🏠</div><strong>${p.unit_type}</strong><br><small>Type</small></div>
        <div style="text-align:center;"><div style="font-size:1.4rem;">${p.listing_type === "Rent" ? "🔑" : "💰"}</div><strong>${p.listing_type === "Rent" ? "For Rent" : "For Sale"}</strong><br><small>Listing</small></div>
      </div>
      ${p.description ? `<div class="detail-desc" style="margin:20px 0;"><h3>Description</h3><p style="line-height:1.7;color:#444;">${p.description}</p></div>` : ""}
      <div class="detail-amenities" style="margin:20px 0;">
        <h3>Amenities</h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">${amenitiesList}</div>
      </div>
      ${p.owner_phone ? `
      <div class="detail-contact" style="margin:30px 0;padding:20px;background:#f0f4ff;border-radius:12px;">
        <h3 style="margin-top:0;">Contact Owner</h3>
        <a href="tel:${p.owner_phone}" class="btn btn-primary" style="display:inline-block;text-decoration:none;margin-right:12px;">📞 Call: ${p.owner_phone}</a>
        <a href="https://wa.me/${p.owner_phone.replace(/\D/g,"")}" target="_blank" class="btn btn-outline" style="display:inline-block;text-decoration:none;">💬 WhatsApp</a>
      </div>` : ""}
    </div>
    <style>
      .amenity-tag{background:#e8f4fd;color:#1565c0;padding:6px 14px;border-radius:20px;font-size:13px;}
    </style>
  `;
}

// ─────────────────────────────────────────────
// Homepage search
// ─────────────────────────────────────────────
function searchProperties() {
  const val = document.getElementById("search-input")?.value.trim();
  if (!val) return;
  sessionStorage.setItem("re_search", val);
  window.location.href = "buy.html";
}

function applySmartSearchFilter() {
  const val = sessionStorage.getItem("re_search");
  if (!val) return;
  // Will be consumed inside renderAllListings
}

// ─────────────────────────────────────────────
// NEW PROJECTS page — Developer Cards + Modal
// ─────────────────────────────────────────────
let _allProjectsData = []; // cache for filter

async function renderDevelopers() {
  const grid = document.getElementById("developer-grid");
  if (!grid) return;
  grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>Loading projects…</p>";

  const { ok, data } = await apiCall("GET", "/properties?limit=200");
  if (!ok || !Array.isArray(data)) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;color:#c00;'>Failed to load projects.</p>";
    return;
  }

  _allProjectsData = data;
  _renderDeveloperCards(data);
}

function _renderDeveloperCards(data) {
  const grid = document.getElementById("developer-grid");
  if (!grid) return;

  if (!data.length) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>No projects found.</p>";
    return;
  }

  // Group by developer
  const devMap = {};
  data.forEach(p => {
    if (!devMap[p.developer]) devMap[p.developer] = [];
    devMap[p.developer].push(p);
  });

  grid.innerHTML = Object.entries(devMap).map(([dev, props]) => {
    const sample    = props[0];
    const imgUrl    = sample.image_url
      ? `${API_BASE.replace("/api", "")}${sample.image_url}`
      : "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80";
    const projects  = [...new Set(props.map(p => p.project))];
    const minPrice  = Math.min(...props.map(p => p.price));

    return `
      <div class="property-card developer-card" style="cursor:pointer;"
           onclick="openDeveloperModal('${encodeURIComponent(dev)}')">
        <div style="height:200px;background:url('${imgUrl}') center/cover;border-radius:12px 12px 0 0;"></div>
        <div style="padding:16px;">
          <h3 style="margin:0 0 8px;">${dev}</h3>
          <div style="color:#666;font-size:13px;margin-bottom:8px;">
            📦 ${props.length} unit${props.length > 1 ? "s" : ""} &nbsp;|&nbsp;
            🏗 ${projects.length} project${projects.length > 1 ? "s" : ""}
          </div>
          <div style="color:#888;font-size:12px;margin-bottom:8px;">
            ${projects.slice(0, 3).join(" · ")}${projects.length > 3 ? " …" : ""}
          </div>
          <div class="property-price">From $${Number(minPrice).toLocaleString("en-US")}</div>
        </div>
      </div>`;
  }).join("");
}

function filterDevelopers() {
  if (!_allProjectsData.length) return;

  const devFilter     = document.getElementById("filter-developer")?.value || "";
  const projectFilter = document.getElementById("filter-project")?.value || "";
  const unitFilter    = document.getElementById("filter-unit")?.value || "";

  let filtered = _allProjectsData;
  if (devFilter)     filtered = filtered.filter(p => p.developer === devFilter);
  if (projectFilter) filtered = filtered.filter(p => p.project   === projectFilter);
  if (unitFilter)    filtered = filtered.filter(p => p.unit_type  === unitFilter);

  _renderDeveloperCards(filtered);
}

function openDeveloperModal(devEncoded) {
  const dev   = decodeURIComponent(devEncoded);
  const props = _allProjectsData.filter(p => p.developer === dev);

  const container = document.getElementById("project-details-container");
  const modal     = document.getElementById("project-modal");
  if (!container || !modal) return;

  // Group by project
  const projectMap = {};
  props.forEach(p => {
    if (!projectMap[p.project]) projectMap[p.project] = [];
    projectMap[p.project].push(p);
  });

  container.innerHTML = `
    <h2 style="margin-top:0;">🏢 ${dev}</h2>
    <p style="color:#666;">${props.length} unit${props.length > 1 ? "s" : ""} across ${Object.keys(projectMap).length} project${Object.keys(projectMap).length > 1 ? "s" : ""}</p>
    ${Object.entries(projectMap).map(([proj, units]) => {
      const minPrice = Math.min(...units.map(u => u.price));
      const types    = [...new Set(units.map(u => u.unit_type))].join(", ");
      return `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
            <div>
              <h3 style="margin:0 0 4px;">${proj}</h3>
              <div style="color:#666;font-size:13px;">📍 ${units[0].area} &nbsp;·&nbsp; ${types}</div>
            </div>
            <div style="font-weight:700;color:var(--primary,#4f46e5);">From $${Number(minPrice).toLocaleString("en-US")}</div>
          </div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">
            ${units.map(u => `
              <div onclick="closeProjectModal();viewProperty('${u.id}')"
                   style="cursor:pointer;background:#f3f4f6;border-radius:8px;padding:8px 12px;font-size:13px;transition:background .2s;"
                   onmouseover="this.style.background='#e0e7ff'" onmouseout="this.style.background='#f3f4f6'">
                🛏 ${u.bedrooms}bd · 🚿 ${u.bathrooms}ba · ${u.bua}m²
                <br><small style="color:#888;">$${Number(u.price).toLocaleString("en-US")}</small>
              </div>`).join("")}
          </div>
        </div>`;
    }).join("")}
  `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeProjectModal() {
  const modal = document.getElementById("project-modal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "";
}

// Close modal on overlay click
document.addEventListener("click", (e) => {
  const modal = document.getElementById("project-modal");
  if (modal && e.target === modal) closeProjectModal();
});

// ─────────────────────────────────────────────
// MY PROPERTIES — owner dashboard list
// ─────────────────────────────────────────────
async function renderMyProperties() {
  const grid = document.getElementById("my-properties-grid");
  if (!grid) return;
  if (!isLoggedIn()) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;'>Please <a href='login.html'>login</a> to see your properties.</p>";
    return;
  }
  grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>Loading…</p>";

  const { ok, data } = await apiCall("GET", "/my-properties");
  if (!ok || !Array.isArray(data) || data.length === 0) {
    grid.innerHTML = "<p style='text-align:center;padding:40px;color:#888;'>You have no properties yet.</p>";
    return;
  }

  grid.innerHTML = data.map(p => `
    <div class="property-card">
      ${createPropertyCard(p).replace(`onclick="viewProperty('${p.id}')"`, "")}
      <div style="padding:0 16px 16px;display:flex;gap:10px;">
        <button class="btn btn-outline" onclick="viewProperty('${p.id}')" style="flex:1;">View</button>
        <button class="btn btn-primary" style="flex:1;background:#c62828;" onclick="deleteMyProperty('${p.id}')">Delete</button>
      </div>
    </div>`).join("");
}

async function deleteMyProperty(id) {
  if (!confirm("Are you sure you want to delete this property?")) return;
  const { ok, data } = await apiCall("DELETE", `/properties/${id}`);
  if (ok) {
    showToast("Property deleted", "success");
    renderMyProperties();
  } else {
    showToast(data.error || "Failed to delete", "error");
  }
}

// ─────────────────────────────────────────────
// Init on page load
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateNavbar();

  // Auto-run new_projects page
  const page = window.location.pathname.split("/").pop();
  if (page === "new_projects.html") {
    renderNewProjects();
  }
});
