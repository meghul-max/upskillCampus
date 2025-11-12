// script.js - frontend logic
const API = 'http://localhost:5000/api';
/* utility */
function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

/* CART stored in localStorage as array of {id, name, price, quantity, image} */
function getCart(){ return JSON.parse(localStorage.getItem('cart') || '[]') }
function saveCart(c){ localStorage.setItem('cart', JSON.stringify(c)) }
function addToCart(product){
  const cart = getCart();
  const item = cart.find(i => i.id === product.id);
  if(item) item.quantity += 1; else cart.push({...product, quantity:1});
  saveCart(cart);
  alert(product.name + ' added to cart');
  updateCartCount();
}
function updateCartCount(){
  const count = getCart().reduce((s,i)=>s+i.quantity,0);
  const el = qs('#cart-count'); if(el) el.textContent = count;
}

/* Load products from backend and render */
async function loadProducts(containerSelector = '#product-list', opts = {}){
  try {
    const res = await fetch(API + '/products');
    const products = await res.json();
    const container = qs(containerSelector);
    if(!container) return;
    container.innerHTML = '';
    // optional search / filter
    const q = (qs('#search')?.value || '').toLowerCase();
    const cat = qs('#filter-category')?.value || '';
    const filtered = products.filter(p => {
      if(cat && p.category !== cat) return false;
      if(q && !(p.name+p.category+p.make||'').toLowerCase().includes(q)) return false;
      return true;
    });
    filtered.forEach(p => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p class="small">${p.category} • Stock: ${p.stock||'--'}</p>
        <p><strong>₹${p.price}</strong></p>
        <button class="btn" data-id="${p.id}">Add to Cart</button>
      `;
      container.appendChild(el);
    });
    qsa(containerSelector + ' .btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const p = (await fetch(API + '/products').then(r=>r.json())).find(x=>x.id===id);
        addToCart({ id: p.id, name: p.name, price: p.price, image: p.image });
      });
    });
  } catch(e){
    console.error('loadProducts err', e);
  }
}

/* Render cart page */
function renderCartPage(){
  const container = qs('#cart-items');
  if(!container) return;
  const cart = getCart();
  if(cart.length === 0){ container.innerHTML = '<div class="card"><p>Your cart is empty</p></div>'; qs('#cart-total').textContent='₹0'; return; }
  container.innerHTML = '';
  let total = 0;
  cart.forEach((it, idx) => {
    total += it.price * it.quantity;
    const el = document.createElement('div');
    el.className = 'card';
    el.style.flexDirection = 'row';
    el.style.alignItems = 'center';
    el.innerHTML = `
      <img src="${it.image}" style="width:100px;height:70px;object-fit:cover;margin-right:12px">
      <div style="flex:1">
        <h4>${it.name}</h4>
        <p class="small">₹${it.price} × ${it.quantity} = ₹${it.price*it.quantity}</p>
        <div>
          <button class="btn" data-idx="${idx}" data-op="inc">+</button>
          <button class="btn" data-idx="${idx}" data-op="dec">-</button>
          <button class="btn" data-idx="${idx}" data-op="rem">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(el);
  });
  qs('#cart-total').textContent = '₹' + total;
  qsa('[data-op]').forEach(b => {
    b.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.idx);
      const op = e.currentTarget.dataset.op;
      const cart = getCart();
      if(op === 'inc') cart[idx].quantity += 1;
      else if(op === 'dec') cart[idx].quantity = Math.max(1, cart[idx].quantity - 1);
      else if(op === 'rem') cart.splice(idx,1);
      saveCart(cart);
      renderCartPage();
      updateCartCount();
    });
  });
}

/* Checkout - collect form values and POST /api/order */
async function placeOrder(event){
  event.preventDefault();
  const name = qs('#ship-name').value.trim();
  const phone = qs('#ship-phone').value.trim();
  const address = qs('#ship-address').value.trim();
  const city = qs('#ship-city').value.trim();
  if(!name || !phone || !address || !city){ alert('Please fill shipping details'); return; }
  const cart = getCart();
  if(cart.length === 0){ alert('Cart empty'); return; }
  const total = cart.reduce((s,i)=>s+i.price*i.quantity,0);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const payload = {
    userEmail: currentUser ? currentUser.email : 'guest',
    name, phone, address, city,
    items: cart,
    total
  };
  try {
    const res = await fetch(API + '/order', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await res.json();
    if(res.ok){
      localStorage.removeItem('cart');
      updateCartCount();
      alert('Order placed. ID: ' + j.orderId);
      window.location.href = 'orders.html';
    } else {
      alert(j.message || 'Unable to place order');
    }
  } catch(e){
    console.error(e);
    alert('Network error placing order');
  }
}

/* Register & login forms */
async function registerUser(event){
  event.preventDefault();
  const name = qs('#reg-name').value.trim();
  const phone = qs('#reg-phone').value.trim();
  const email = qs('#reg-email').value.trim();
  const pass = qs('#reg-pass').value;
  const pass2 = qs('#reg-pass2').value;
  if(pass !== pass2){ alert('Passwords do not match'); return; }
  try {
    const res = await fetch(API + '/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, phone, email, password: pass}) });
    const j = await res.json();
    if(res.ok){ localStorage.setItem('currentUser', JSON.stringify({name, email, phone})); alert('Registered'); window.location.href='profile.html' }
    else alert(j.message || 'Registration error');
  } catch(e){ console.error(e); alert('Network error') }
}

async function loginUser(event){
  event.preventDefault();
  const email = qs('#login-email').value.trim();
  const pass = qs('#login-pass').value;
  try {
    const res = await fetch(API + '/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: pass}) });
    const j = await res.json();
    if(res.ok){ localStorage.setItem('currentUser', JSON.stringify(j.user)); alert('Login successful'); window.location.href='profile.html' }
    else alert(j.message || 'Login failed');
  } catch(e){ console.error(e); alert('Network error') }
}

/* Profile & Orders rendering */
function renderProfile(){
  const cur = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const el = qs('#profile-details');
  if(!el) return;
  if(!cur) { el.innerHTML = '<p>Please <a href="login.html">login</a>.</p>'; return; }
  el.innerHTML = `<p><strong>Name:</strong> ${cur.name}</p><p><strong>Email:</strong> ${cur.email}</p><p><strong>Phone:</strong> ${cur.phone||''}</p><button class="btn" id="logout-btn">Logout</button>`;
  qs('#logout-btn').addEventListener('click', ()=>{ localStorage.removeItem('currentUser'); alert('Logged out'); window.location.href='index.html' });
}

/* Orders page - fetch orders filtered by current user */
async function renderOrders(){
  const el = qs('#orders-list'); if(!el) return;
  const cur = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const url = cur ? (API + '/orders?user=' + encodeURIComponent(cur.email)) : (API + '/orders');
  try {
    const res = await fetch(url);
    const orders = await res.json();
    if(!orders || orders.length === 0) { el.innerHTML = '<div class="card">No orders found.</div>'; return; }
    el.innerHTML = '';
    orders.forEach(o => {
      const d = document.createElement('div'); d.className = 'card';
      d.innerHTML = `<h4>Order ${o.id}</h4><small>${new Date(o.date).toLocaleString()}</small><p>Total: ₹${o.total}</p><div>${o.items.map(it=>`<div>${it.name} × ${it.quantity} = ₹${it.price*it.quantity}</div>`).join('')}</div><p>Ship to: ${o.name}, ${o.address}, ${o.city}</p>`;
      el.appendChild(d);
    });
  } catch(e){ console.error(e); el.innerHTML = '<div class="card">Unable to load orders</div>'; }
}

/* header links update */
function renderHeader(){
  const cur = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const auth = qs('#auth-link');
  if(auth) auth.textContent = cur ? 'Profile' : 'Login';
  updateCartCount();
}

/* Initialise helpers on pages */
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  if(qs('#product-list')) loadProducts('#product-list');
  if(qs('#cart-items')) renderCartPage();
  if(qs('#checkout-form')) qs('#checkout-form').addEventListener('submit', placeOrder);
  if(qs('#register-form')) qs('#register-form').addEventListener('submit', registerUser);
  if(qs('#login-form')) qs('#login-form').addEventListener('submit', loginUser);
  if(qs('#profile-details')) renderProfile();
  if(qs('#orders-list')) renderOrders();
  // category filter filler (optional)
  (async()=>{
    try{
      const products = await fetch(API + '/products').then(r=>r.json());
      const cats = [...new Set(products.map(p=>p.category))];
      if(qs('#filter-category')){
        qs('#filter-category').innerHTML = `<option value="">All Categories</option>` + cats.map(c=>`<option>${c}</option>`).join('');
        qs('#filter-category').addEventListener('change', ()=> loadProducts('#product-list'));
      }
    }catch(e){}
  })();
});
