// ── STATE ──
const cart = [];
let currentProduct = 'tank';
let selectedOption = null;
let selectedDelivery = 'surplace';
let deliveryPrice = 0;
let deliveryAddress = '';
let deliveryDistanceKm = 0;

// Statut shop (chargé depuis le serveur)
let shopStatus = { on: true, tank: true, bonbonne: true };

const ORIGIN = [50.6292, 3.0573];
const PRICE_PER_KM = 0.75;
const API_URL       = 'https://cdl59-bot-production.up.railway.app/order';
const STATUS_URL    = 'https://cdl59-bot-production.up.railway.app/status';
const HEARTBEAT_URL = 'https://cdl59-bot-production.up.railway.app/heartbeat';
const API_SECRET = 'CDL59040623';

// ID de session anonyme pour tracking actifs
const SESSION_UID = (() => {
  let uid = sessionStorage.getItem('cdl_uid');
  if (!uid) { uid = Math.random().toString(36).slice(2); sessionStorage.setItem('cdl_uid', uid); }
  return uid;
})();

function sendHeartbeat() {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const uid = tgUser ? `tg_${tgUser.id}` : `s_${SESSION_UID}`;
  fetch(HEARTBEAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid })
  }).catch(() => {});
}

const PRODUCTS = {
  tank: {
    name: 'TANK Black Cobra',
    weight: '2000g',
    img: 'images/tank.png',
    desc: 'La bonbonne XXL pour les vrais. Cream Charger premium N2O, qualité professionnelle.',
    badges: ['2000g', 'Premium', 'CDL'],
    options: [
      { label: '1 TANK',  price: 50  },
      { label: '2 TANKS', price: 90  },
      { label: '3 TANKS', price: 120 },
    ]
  },
  bonbonne: {
    name: 'Bonbonne Black Cobra',
    weight: '666g',
    img: 'images/bonbonne.png',
    desc: 'La bonbonne compacte Black Cobra. Idéale pour usage personnel.',
    badges: ['666g', 'Compact', 'CDL'],
    options: [
      { label: '1 Bonbonne',  price: 30 },
      { label: '2 Bonbonnes', price: 40 },
      { label: '3 Bonbonnes', price: 60 },
    ]
  }
};

// ── NAV ──
function navigate(screen) {
  // Si shop OFF, bloquer la navigation vers produits/panier
  if (!shopStatus.on && (screen === 'produits' || screen === 'panier')) {
    showShopClosed();
    return;
  }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.getElementById('nav-' + screen).classList.add('active');
  if (screen === 'accueil') startConfetti();
  else stopConfetti();
}

function showShopClosed() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-accueil').classList.add('active');
  document.getElementById('nav-accueil').classList.add('active');
  stopConfetti();

  const hero = document.querySelector('.home-hero');
  if (hero && !document.getElementById('shop-closed-banner')) {
    const banner = document.createElement('div');
    banner.id = 'shop-closed-banner';
    banner.innerHTML = `
      <div style="
        background: linear-gradient(135deg,#1a0a0a,#2a0f0f);
        border: 1px solid #ef4444;
        border-radius: 16px;
        margin: 16px;
        padding: 24px 20px;
        text-align: center;
      ">
        <div style="font-size:40px;margin-bottom:12px;">🔴</div>
        <div style="font-size:18px;font-weight:700;color:#ef4444;margin-bottom:8px;">CDL est indisponible</div>
        <div style="font-size:14px;color:#8a9bb0;line-height:1.5;">Le shop est momentanément fermé.<br>Revenez plus tard !</div>
      </div>
    `;
    hero.after(banner);
  }
}

// ── PRODUITS ──
function selectProduct(id) {
  currentProduct = id;
  selectedOption = null;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.product === id));
  renderProduct();
}

function renderDeliveryBlock() {
  const isLivraison = selectedDelivery === 'livraison';

  let addressBlock = '';
  if (isLivraison) {
    let priceInfo = '';
    if (deliveryPrice > 0) {
      priceInfo = `
        <div class="delivery-calc-result">
          <span class="calc-distance">📍 ${deliveryDistanceKm.toFixed(1)} km</span>
          <span class="calc-price">Livraison : <strong>${deliveryPrice}€</strong></span>
        </div>`;
    }
    addressBlock = `
      <div class="address-input-block">
        <div class="address-input-wrap">
          <input
            type="text"
            id="address-input"
            class="address-input"
            placeholder="Tape ton adresse..."
            value="${deliveryAddress}"
            oninput="onAddressInput(this.value)"
            onkeydown="if(event.key==='Enter'){ hideAutocomplete(); calcDelivery(); }"
            autocomplete="off"
          >
          <div class="autocomplete-list" id="autocomplete-list" style="display:none"></div>
        </div>
        <button class="calc-btn" onclick="calcDelivery()" id="calc-btn">
          Calculer
        </button>
        ${priceInfo}
        <div class="calc-error" id="calc-error"></div>
      </div>`;
  }

  return `
    <div class="delivery-section">
      <div class="section-title">🚚 Livraison</div>
      <div class="delivery-row${selectedDelivery === 'surplace' ? ' selected' : ''}" onclick="selectDelivery('surplace')">
        <span class="delivery-icon">🏠</span>
        <div class="delivery-info">
          <div class="delivery-name">Sur place</div>
          <div class="delivery-desc">Retrait à Lille</div>
        </div>
        <div class="delivery-price">Gratuit</div>
      </div>
      <div class="delivery-row${isLivraison ? ' selected' : ''}" onclick="selectDelivery('livraison')">
        <span class="delivery-icon">🛵</span>
        <div class="delivery-info">
          <div class="delivery-name">Livraison à domicile</div>
          <div class="delivery-desc">0,75€/km · arrondi à l'euro</div>
        </div>
        <div class="delivery-price">${deliveryPrice > 0 ? deliveryPrice + '€' : 'Calculer'}</div>
      </div>
      ${addressBlock}
    </div>`;
}

function renderProduct() {
  const p = PRODUCTS[currentProduct];
  const detail = document.getElementById('product-detail');
  const inStock = shopStatus[currentProduct] !== false;
  const canAdd = inStock && selectedOption !== null && (selectedDelivery === 'surplace' || deliveryPrice > 0);

  if (!inStock) {
    detail.innerHTML = `
      <div class="product-showcase">
        <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'" style="opacity:0.4;filter:grayscale(1)">
        <div class="product-name">${p.name}</div>
        <div class="badge-row"><span class="badge" style="background:#ef4444;color:#fff">Rupture de stock</span></div>
        <div class="product-desc" style="color:#ef4444">Ce produit est temporairement indisponible.<br>Revenez bientôt !</div>
      </div>
    `;
    return;
  }

  detail.innerHTML = `
    <div class="product-showcase">
      <img src="${p.img}" alt="${p.name}" onerror="this.style.display='none'">
      <div class="product-name">${p.name}</div>
      <div class="badge-row">${p.badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>
      <div class="product-desc">${p.desc}</div>
    </div>

    <div class="options-section">
      <div class="section-title">💰 Options & Prix</div>
      ${p.options.map((opt, i) => `
        <div class="option-row${selectedOption === i ? ' selected' : ''}" onclick="selectOption(${i})">
          <div class="radio-circle"></div>
          <span class="option-check">✓</span>
          <span class="option-label">${opt.label}</span>
          <span class="option-price">${opt.price}€</span>
        </div>
      `).join('')}
    </div>

    ${renderDeliveryBlock()}

    <button class="add-btn" onclick="addToCart()" ${!canAdd ? 'disabled' : ''}>
      ${selectedOption === null
        ? 'Choisir une option'
        : selectedDelivery === 'livraison' && deliveryPrice === 0
          ? 'Calculer la livraison'
          : '🛒 Ajouter au panier'}
    </button>
  `;
}

function selectOption(i) {
  selectedOption = i;
  renderProduct();
}

function selectDelivery(type) {
  selectedDelivery = type;
  if (type === 'surplace') {
    deliveryPrice = 0;
    deliveryAddress = '';
    deliveryDistanceKm = 0;
  }
  renderProduct();
}

// ── AUTOCOMPLETE ──
let autocompleteTimer = null;
let selectedCoords = null;
let lastQuery = '';

function onAddressInput(val) {
  deliveryAddress = val;
  selectedCoords = null;
  deliveryPrice = 0;
  deliveryDistanceKm = 0;
  clearTimeout(autocompleteTimer);
  hideAutocomplete();

  if (val.trim().length < 3) return;

  autocompleteTimer = setTimeout(() => fetchSuggestions(val.trim()), 400);
}

async function fetchSuggestions(query) {
  lastQuery = query;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=fr,be&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    const data = await res.json();
    showAutocomplete(data);
  } catch (e) { /* réseau indispo, on ignore */ }
}

function showAutocomplete(results) {
  const list = document.getElementById('autocomplete-list');
  if (!list) return;
  if (!results.length) { hideAutocomplete(); return; }

  list.innerHTML = results.map((r, i) => {
    const label = r.display_name;
    const short = formatAddress(r);
    return `<div class="autocomplete-item" onclick="selectAddress(${i})" data-idx="${i}" data-lat="${r.lat}" data-lon="${r.lon}" data-label="${label.replace(/"/g, '&quot;')}">
      <span class="ac-icon">📍</span>
      <span class="ac-text">${short}</span>
    </div>`;
  }).join('');

  list.style.display = 'block';
}

function formatAddress(r) {
  const a = r.address || {};
  const roadName = a.road || a.pedestrian || a.footway || '';

  // Si Nominatim n'a pas le numéro, on essaie de le récupérer depuis ce que l'utilisateur a tapé
  let houseNum = a.house_number || '';
  if (!houseNum) {
    const match = lastQuery.match(/^(\d+[a-zA-Z]?)\s/);
    if (match) houseNum = match[1];
  }

  const street = [houseNum, roadName].filter(Boolean).join(' ');
  const parts = [
    street || null,
    a.city || a.town || a.village || a.municipality,
    a.postcode
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : r.display_name.split(',').slice(0, 3).join(',');
}

function hideAutocomplete() {
  const list = document.getElementById('autocomplete-list');
  if (list) list.style.display = 'none';
}

function selectAddress(idx) {
  const items = document.querySelectorAll('.autocomplete-item');
  const item = items[idx];
  if (!item) return;

  const lat = parseFloat(item.dataset.lat);
  const lon = parseFloat(item.dataset.lon);
  const label = item.dataset.label;

  // Affiche une version courte dans l'input
  const a = item.querySelector('.ac-text').textContent;
  deliveryAddress = a;
  selectedCoords = [lat, lon];

  const inp = document.getElementById('address-input');
  if (inp) inp.value = a;

  hideAutocomplete();
  calcDeliveryWithCoords(lat, lon);
}

// ── CALCUL LIVRAISON ──
async function calcDelivery() {
  const inp = document.getElementById('address-input');
  const addr = inp ? inp.value.trim() : '';

  if (!addr) { showCalcError('Entre ton adresse pour calculer.'); return; }

  // Si l'utilisateur a sélectionné via autocomplete, coords déjà connues
  if (selectedCoords) {
    calcDeliveryWithCoords(selectedCoords[0], selectedCoords[1]);
    return;
  }

  // Sinon on géocode le texte libre
  setBtnLoading(true);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=fr,be`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    const data = await res.json();
    if (!data.length) {
      showCalcError('Adresse introuvable. Utilise les suggestions qui apparaissent en tapant.');
      setBtnLoading(false);
      return;
    }
    await calcDeliveryWithCoords(parseFloat(data[0].lat), parseFloat(data[0].lon));
  } catch (e) {
    showCalcError('Erreur réseau. Vérifie ta connexion.');
    setBtnLoading(false);
  }
}

async function calcDeliveryWithCoords(lat, lon) {
  setBtnLoading(true);
  clearError();
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${ORIGIN[1]},${ORIGIN[0]};${lon},${lat}?overview=false`;
    const res = await fetch(osrmUrl);
    const data = await res.json();

    if (data.code !== 'Ok') {
      showCalcError("Impossible de calculer l'itinéraire.");
      setBtnLoading(false);
      return;
    }

    deliveryDistanceKm = data.routes[0].distance / 1000;
    deliveryPrice = Math.round(deliveryDistanceKm * PRICE_PER_KM);
    if (deliveryPrice < 1) deliveryPrice = 1;

    renderProduct();
  } catch (e) {
    showCalcError('Erreur réseau. Vérifie ta connexion.');
    setBtnLoading(false);
  }
}

function setBtnLoading(loading) {
  const btn = document.getElementById('calc-btn');
  if (!btn) return;
  btn.textContent = loading ? '...' : 'Calculer';
  btn.disabled = loading;
}

function showCalcError(msg) {
  const el = document.getElementById('calc-error');
  if (el) el.textContent = msg;
}

function clearError() {
  const el = document.getElementById('calc-error');
  if (el) el.textContent = '';
}

// ── PANIER ──
function addToCart() {
  if (selectedOption === null) return;
  if (selectedDelivery === 'livraison' && deliveryPrice === 0) return;

  const p = PRODUCTS[currentProduct];
  const opt = p.options[selectedOption];
  const total = opt.price + (selectedDelivery === 'livraison' ? deliveryPrice : 0);

  cart.push({
    product: currentProduct,
    name: p.name,
    img: p.img,
    option: opt.label,
    price: opt.price,
    delivery: selectedDelivery,
    deliveryPrice: selectedDelivery === 'livraison' ? deliveryPrice : 0,
    deliveryLabel: selectedDelivery === 'surplace' ? 'Sur place — Gratuit' : `Livraison ${deliveryDistanceKm.toFixed(1)}km — ${deliveryPrice}€`,
    deliveryAddress: selectedDelivery === 'livraison' ? deliveryAddress : '',
    total
  });

  updateCartBadge();
  showToast('✅ Ajouté au panier !');
  // Pop animation sur le badge panier
  const badge = document.getElementById('cart-badge');
  if (badge) { badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop'); }
  selectedOption = null;
  deliveryPrice = 0;
  deliveryAddress = '';
  deliveryDistanceKm = 0;
  renderProduct();
}

function removeFromCart(i) {
  cart.splice(i, 1);
  updateCartBadge();
  renderCart();
}

function clearCart() {
  cart.length = 0;
  updateCartBadge();
  renderCart();
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (cart.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = cart.length;
  } else {
    badge.style.display = 'none';
  }
}

function renderCart() {
  const container = document.getElementById('cart-content');
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Ton panier est vide.<br>Ajoute des produits pour commander.</p>
      </div>
    `;
    return;
  }

  const total = cart.reduce((s, i) => s + i.total, 0);

  container.innerHTML = `
    <div class="cart-items">
      ${cart.map((item, i) => `
        <div class="cart-item">
          <img src="${item.img}" alt="${item.name}" onerror="this.style.opacity='0'">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-option">${item.option} — ${item.price}€</div>
            <div class="cart-item-delivery">${item.deliveryLabel}</div>
            <div class="cart-item-price">Total : ${item.total}€</div>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${i})">✕</button>
        </div>
      `).join('')}
    </div>

    <div class="cart-summary">
      <div class="summary-row total"><span>Total commande</span><span>${total}€</span></div>
    </div>

    <button class="order-btn" onclick="sendOrder()">📲 Envoyer ma commande</button>
  `;
}

async function sendOrder() {
  if (cart.length === 0) return;
  if (!shopStatus.on) {
    showToast('❌ Le shop est fermé pour le moment.');
    return;
  }

  // Récupérer infos utilisateur Telegram si dispo
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const username = tgUser
    ? (tgUser.username ? `@${tgUser.username}` : `${tgUser.first_name} (ID: ${tgUser.id})`)
    : 'Client web';

  // Afficher confirmation et vider panier immédiatement
  const orderSnapshot = [...cart];
  cart.length = 0;
  updateCartBadge();
  showConfirmation();

  // Envoyer via notre API sécurisée (token bot reste côté serveur)
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': API_SECRET
      },
      body: JSON.stringify({
        username,
        order: orderSnapshot.map(i => ({
          name: i.name,
          option: i.option,
          price: i.price,
          delivery: i.delivery,
          deliveryPrice: i.deliveryPrice,
          deliveryAddress: i.deliveryAddress,
          distanceKm: parseFloat(i.deliveryLabel.match(/([\d.]+)km/)?.[1] || 0),
          total: i.total
        }))
      })
    });
  } catch (e) { /* ignore réseau */ }
}

function showConfirmation() {
  const container = document.getElementById('cart-content');
  container.innerHTML = `
    <div class="confirm-screen">
      <div class="confirm-circle">
        <svg viewBox="0 0 80 80" class="confirm-svg">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#f5c518" stroke-width="3" class="confirm-ring"/>
          <polyline points="24,40 35,52 56,28" fill="none" stroke="#f5c518" stroke-width="4"
            stroke-linecap="round" stroke-linejoin="round" class="confirm-check"/>
        </svg>
      </div>
      <div class="confirm-title">Commande envoyée !</div>
      <div class="confirm-msg">
        Merci pour ta commande 🎈<br>
        Un membre de l'équipe te contactera<br>au plus vite.
      </div>
      <div class="confirm-brand">🖤 CDL 59 — Les premiers. Les vrais.</div>
      <button class="confirm-btn" onclick="navigate('accueil')">🔄 Repasser une commande</button>
    </div>
  `;
}

// ── TOAST ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── CONFETTIS ──
// ── CONFETTI INFINI EN ARRIERE-PLAN ──
let confettiFrame = null;
let confettiActive = false;

function startConfetti() {
  if (confettiActive) return;
  confettiActive = true;

  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#f5c518', '#d4a017', '#fff8c0', '#ffe066', '#ffd700', '#ffffff'];
  const pieces = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    w: Math.random() * 7 + 3,
    h: Math.random() * 12 + 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 1.5 + 0.5,
    angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 3,
    drift: (Math.random() - 0.5) * 0.8,
    opacity: Math.random() * 0.4 + 0.2
  }));

  function draw() {
    if (!confettiActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.y += p.speed;
      p.x += p.drift;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
      if (p.x < -20) p.x = canvas.width + 20;
      if (p.x > canvas.width + 20) p.x = -20;
    });
    confettiFrame = requestAnimationFrame(draw);
  }
  draw();
}

function stopConfetti() {
  confettiActive = false;
  if (confettiFrame) { cancelAnimationFrame(confettiFrame); confettiFrame = null; }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function launchConfetti() { startConfetti(); }

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }

  // Charger le statut du shop
  try {
    const res = await fetch(STATUS_URL);
    if (res.ok) shopStatus = await res.json();
  } catch (e) { /* si erreur réseau, shop considéré ouvert */ }

  renderProduct();
  renderCart();
  navigate('accueil');
  setTimeout(launchConfetti, 400);

  // Heartbeat actifs
  sendHeartbeat();
  setInterval(sendHeartbeat, 30000);
});

