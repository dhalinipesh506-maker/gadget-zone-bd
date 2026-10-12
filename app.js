/* Gadget Zone BD
 * Never put secret service_role keys in this file.
 */
(() => {
  "use strict";

  const SUPABASE_URL = "";
  const SUPABASE_ANON_KEY = "";
  const ORDER_FUNCTION = "create-cod-order";

  const money = n => new Intl.NumberFormat("bn-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0
  }).format(n);

  const categories = {
    Mobile: "মোবাইল",
    Earbuds: "ইয়ারবাডস",
    Chargers: "চার্জার",
    Smartwatches: "স্মার্টওয়াচ"
  };

  const demoProducts = [
    {id:"demo-phone-1",name:"Nova X5 Smartphone",category:"Mobile",price:18990,stock:8,emoji:"📱",description:"দৈনন্দিন ব্যবহারের স্মার্টফোন",badge:"জনপ্রিয়"},
    {id:"demo-phone-2",name:"Orbit A3 Smartphone",category:"Mobile",price:12990,stock:5,emoji:"📱",description:"স্মার্ট ফিচার, দারুণ ব্যবহার",badge:"ভ্যালু"},
    {id:"demo-ear-1",name:"AirBeat TWS Earbuds",category:"Earbuds",price:1490,stock:14,emoji:"🎧",description:"ওয়্যারলেস অডিও, কমপ্যাক্ট ডিজাইন",badge:"হট"},
    {id:"demo-ear-2",name:"BassPods Lite",category:"Earbuds",price:990,stock:0,emoji:"🎵",description:"মিউজিক ও কলের জন্য",badge:"স্টক শেষ"},
    {id:"demo-charge-1",name:"FastCharge 25W Adapter",category:"Chargers",price:790,stock:20,emoji:"🔌",description:"দ্রুত চার্জিং অ্যাডাপ্টার",badge:"জনপ্রিয়"},
    {id:"demo-charge-2",name:"USB-C Braided Cable",category:"Chargers",price:290,stock:30,emoji:"🔋",description:"টেকসই USB-C কেবল",badge:"নতুন"},
    {id:"demo-watch-1",name:"Pulse S2 Smartwatch",category:"Smartwatches",price:2490,stock:7,emoji:"⌚",description:"দৈনন্দিন স্মার্ট ট্র্যাকিং",badge:"নতুন"},
    {id:"demo-watch-2",name:"Active Fit Watch",category:"Smartwatches",price:1790,stock:4,emoji:"⌚",description:"সিম্পল স্টাইল, স্মার্ট ফিচার",badge:"ভ্যালু"}
  ];

  let products = [...demoProducts];
  let selectedCategory = "সব";
  let cart = loadCart();
  let supabaseClient = null;
  let toastTimer;

  const $ = id => document.getElementById(id);
  const productGrid = $("productGrid");
  const cartDrawer = $("cartDrawer");
  const drawerBackdrop = $("drawerBackdrop");
  const checkoutBackdrop = $("checkoutBackdrop");

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem("gzb-cart") || "[]");
      return Array.isArray(raw)
        ? raw.filter(x => x && typeof x.id === "string" &&
            Number.isInteger(x.qty) && x.qty > 0).slice(0, 100)
        : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem("gzb-cart", JSON.stringify(cart));
    } catch {}
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function safeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function visibleProducts() {
    const term = $("searchInput").value.trim().toLocaleLowerCase();

    return products.filter(p =>
      (selectedCategory === "সব" || p.category === selectedCategory) &&
      `${p.name} ${p.description || ""} ${categories[p.category] || p.category}`
        .toLocaleLowerCase().includes(term)
    );
  }

  function renderProducts() {
    const list = visibleProducts();
    $("productTotal").textContent = `${list.length}টি পণ্য`;

    if (!list.length) {
      productGrid.innerHTML =
        '<div class="empty-results">এই নামে কোনো পণ্য পাওয়া যায়নি। অন্যভাবে খুঁজুন।</div>';
      return;
    }

    productGrid.innerHTML = list.map(p => `
      <article class="product-card">
        <div class="product-visual">
          <span class="product-badge">${safeText(p.badge || "গ্যাজেট")}</span>
          <span class="product-emoji" aria-hidden="true">${safeText(p.emoji || "📦")}</span>
        </div>
        <div class="product-info">
          <span class="product-category">${safeText(categories[p.category] || p.category)}</span>
          <h3>${safeText(p.name)}</h3>
          <p class="product-description">${safeText(p.description || "")}</p>
          <div class="product-bottom">
            <span class="price">${money(Number(p.price))}</span>
            <span class="stock ${p.stock > 0 ? "" : "out"}">
              ${p.stock > 0 ? `স্টক: ${p.stock}` : "স্টক শেষ"}
            </span>
          </div>
          <button class="add-button" data-add="${safeText(p.id)}"
            ${p.stock <= 0 ? "disabled" : ""}>
            ${p.stock > 0 ? "+ কার্টে যোগ করুন" : "স্টক নেই"}
          </button>
        </div>
      </article>
    `).join("");
  }

  function getProduct(id) {
    return products.find(p => p.id === id);
  }

  function cartDetails() {
    return cart.map(item => ({
      ...item,
      product: getProduct(item.id)
    })).filter(x => x.product);
  }

  function subtotal() {
    return cartDetails().reduce(
      (sum, x) => sum + Number(x.product.price) * x.qty, 0
    );
  }

  function renderCart() {
    const items = cartDetails();

    $("cartCount").textContent =
      items.reduce((n, x) => n + x.qty, 0);

    $("cartSubtotal").textContent = money(subtotal());
    $("checkoutSubtotal").textContent = money(subtotal());
    $("checkoutOpen").disabled = items.length === 0;

    if (!items.length) {
      $("cartItems").innerHTML =
        '<p class="empty-cart">আপনার কার্ট এখনো খালি।</p>';
      return;
    }

    $("cartItems").innerHTML = items.map(({product:p, qty}) => `
      <div class="cart-item">
        <div class="cart-item-emoji">${safeText(p.emoji || "📦")}</div>
        <div>
          <h3>${safeText(p.name)}</h3>
          <small>${money(p.price)} × ${qty}</small>
          <div class="qty-controls">
            <button data-qty="${safeText(p.id)}" data-delta="-1"
              aria-label="একটি কমান">−</button>
            <span>${qty}</span>
            <button data-qty="${safeText(p.id)}" data-delta="1"
              aria-label="একটি বাড়ান" ${qty >= p.stock ? "disabled" : ""}>+</button>
          </div>
          <button class="remove-button" data-remove="${safeText(p.id)}">
            সরিয়ে ফেলুন
          </button>
        </div>
        <b>${money(p.price * qty)}</b>
      </div>
    `).join("");
  }

  function addToCart(id) {
    const p = getProduct(id);
    if (!p || p.stock < 1) return;

    const existing = cart.find(x => x.id === id);

    if (existing) {
      if (existing.qty >= p.stock) {
        toast("এই পণ্যের যত স্টক আছে, ততটাই কার্টে যোগ করা হয়েছে।");
        return;
      }
      existing.qty++;
    } else {
      cart.push({id, qty:1});
    }

    saveCart();
    renderCart();
    toast("পণ্যটি কার্টে যোগ হয়েছে।");
  }

  function setQuantity(id, delta) {
    const item = cart.find(x => x.id === id);
    const p = getProduct(id);
    if (!item || !p) return;

    item.qty += delta;

    if (item.qty <= 0) {
      cart = cart.filter(x => x.id !== id);
    } else if (item.qty > p.stock) {
      item.qty = p.stock;
    }

    saveCart();
    renderCart();
  }

  function openCart() {
    cartDrawer.classList.add("open");
    drawerBackdrop.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
  }

  function closeCart() {
    cartDrawer.classList.remove("open");
    drawerBackdrop.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");
  }

  function openCheckout() {
    if (!cartDetails().length) return;

    closeCart();
    $("checkoutMessage").hidden = true;
    checkoutBackdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeCheckout() {
    checkoutBackdrop.classList.remove("open");
    document.body.style.overflow = "";
  }

  function configuredSupabase() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
        !window.supabase?.createClient) return null;

    if (!supabaseClient) {
      supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );
    }

    return supabaseClient;
  }

  function showCheckoutMessage(message, kind = "error") {
    const el = $("checkoutMessage");
    el.textContent = message;
    el.className = `notice ${kind}`;
    el.hidden = false;
 }
