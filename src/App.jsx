import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qpkdaubarqnutbunckeh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwa2RhdWJhcnFudXRidW5ja2VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjAzMjAsImV4cCI6MjA5MzEzNjMyMH0.36MsbMngO6lOBzFvKNsMHxk_djEYpzKR3sdCxsT8ids";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const WHATSAPP_PHONE = "34628241616";
const CART_STORAGE_KEY = "outlet_stock_cart_v1";

function euro(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
}

function normalizeStock(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return true;
  return Number(value) > 0;
}

function normalizeSize(size) {
  return {
    id: size.id || size.size_id || size.talla_id || size.talla || size.nombre || size.size || cryptoRandomId(),
    name: size.talla || size.nombre || size.size || size.tamano || size.tamaño || "Única",
    price: Number(size.precio ?? size.price ?? size.precio_talla ?? size.amount ?? 0) || 0,
    stock: normalizeStock(size.stock ?? size.disponible ?? size.activo ?? true)
  };
}

function normalizeProduct(item) {
  const sizesRaw = item.product_sizes || item.tamanos_de_producto || item["tamaños_de_producto"] || item.sizes || [];
  const sizes = Array.isArray(sizesRaw) ? sizesRaw.map(normalizeSize) : [];
  const priceType = String(item.tipo_precio || item.price_type || item.precio_tipo || item.modo_precio || "").toLowerCase();
  const rawPrice = item.precio ?? item.price ?? item.precio_fijo ?? item.fixed_price ?? item.price_fixed ?? 0;
  const sizePrices = sizes.map((s) => Number(s.price)).filter((p) => p > 0);
  const hasSizePrices = sizePrices.length > 0;
  const isFixedPrice = priceType ? priceType.includes("fijo") || priceType.includes("fixed") : !hasSizePrices;
  const price = Number(rawPrice) || (hasSizePrices ? Math.min(...sizePrices) : 0);

  return {
    id: item.id,
    name: item.titulo || item.title || item["título"] || item.nombre || item.name || "Producto sin nombre",
    category: item.categoria || item.category || "General",
    desc: item.descripcion || item.description || item.desc || "Producto disponible en Outlet Stock.",
    image: item.imagen_url || item.image_url || item.imagen || item.image || item.foto || item.url_imagen || "",
    price,
    fixedPrice: Number(rawPrice) || 0,
    isFixedPrice,
    stock: normalizeStock(item.stock ?? item.disponible ?? item.activo ?? true),
    rating: Number(item.rating || item.valoracion || 4.8),
    sizes
  };
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSizeProductId(size) {
  return size.producto_id || size.product_id || size.id_producto || size.producto || size.product || null;
}

function mergeProductsWithSizes(products, sizes) {
  return products.map((product) => ({
    ...product,
    product_sizes: sizes.filter((size) => String(getSizeProductId(size)) === String(product.id))
  }));
}

function buildCategories(products) {
  return ["Todos", ...new Set(products.map((p) => p.category).filter(Boolean))];
}

function filterProducts(products, query, category) {
  const q = query.trim().toLowerCase();
  return products.filter((p) => {
    const okCategory = category === "Todos" || p.category === category;
    const text = `${p.name} ${p.category} ${p.desc}`.toLowerCase();
    return okCategory && text.includes(q);
  });
}

function getProductDisplayPrice(product) {
  if (product.isFixedPrice) return euro(product.price);
  return product.sizes?.length ? `Desde ${euro(product.price)}` : euro(product.price);
}

function cartTotals(cart) {
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  return { count, total };
}

function normalizeStoredCart(cart) {
  if (!Array.isArray(cart)) return [];

  return cart
    .map((item) => ({
      ...item,
      cartId: item.cartId || String(item.id || cryptoRandomId()),
      price: Number(item.price) || 0,
      qty: Math.max(1, Number(item.qty) || 1),
      name: item.name || "Producto sin nombre",
      selectedSize: item.selectedSize || null
    }))
    .filter((item) => item.cartId && item.price >= 0 && item.qty > 0);
}

function loadCartFromStorage() {
  if (typeof window === "undefined") return [];

  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) return [];
    return normalizeStoredCart(JSON.parse(rawCart));
  } catch {
    return [];
  }
}

function saveCartToStorage(cart) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalizeStoredCart(cart)));
  } catch {
    // Si el navegador bloquea localStorage, la tienda sigue funcionando sin persistencia.
  }
}

function buildWhatsAppOrderMessage(cart, total) {
  const lines = [
    "🛒 *Nuevo pedido - Outlet Stock*",
    "",
    "Hola, quiero realizar este pedido:",
    "",
    "━━━━━━━━━━━━━━"
  ];

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.qty;

    lines.push(
      `📦 *Producto ${index + 1}:* ${item.name}`,
      item.selectedSize ? `📌 *Talla:* ${item.selectedSize}` : null,
      `🔢 *Cantidad:* ${item.qty}`,
      `💰 *Precio:* ${euro(item.price)}${item.qty > 1 ? " c/u" : ""}`,
      item.qty > 1 ? `🧾 *Importe:* ${euro(itemTotal)}` : null,
      ""
    );
  });

  lines.push(
    "━━━━━━━━━━━━━━",
    `💵 *Total:* ${euro(total)}`,
    "",
    "Quedo atento para confirmar disponibilidad y coordinar el siguiente paso."
  );

  return lines.filter(Boolean).join(String.fromCharCode(10));
}

function buildWhatsAppUrl(phone, message) {
  const cleanPhone = String(phone).replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

async function fetchFirstAvailableTable(tableNames, options = {}) {
  let lastError = null;

  for (const tableName of tableNames) {
    let query = supabase.from(tableName).select("*");
    if (options.orderBy) query = query.order(options.orderBy, { ascending: false });

    let result = await query;

    if (result.error && options.orderBy) {
      result = await supabase.from(tableName).select("*");
    }

    if (!result.error) {
      return { tableName, data: result.data || [], error: null };
    }

    lastError = result.error;
  }

  return { tableName: null, data: [], error: lastError };
}

function Icon({ name, size = 20, className = "" }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className
  };

  const icons = {
    search: <svg {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>,
    cart: <svg {...props}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>,
    close: <svg {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>,
    plus: <svg {...props}><path d="M12 5v14" /><path d="M5 12h14" /></svg>,
    minus: <svg {...props}><path d="M5 12h14" /></svg>,
    star: <svg {...props} fill="currentColor" stroke="currentColor"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1L12 2Z" /></svg>,
    card: <svg {...props}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
    shield: <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>,
    truck: <svg {...props}><path d="M10 17h4V5H2v12h3" /><path d="M14 17h1" /><path d="M19 17h3v-6h-3l-2-3h-3" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></svg>
  };
  return icons[name] || null;
}

function ProductImage({ src, alt, className = "", overlay = true }) {
  if (!src) {
    return (
      <div className={`relative grid place-items-center bg-gradient-to-br from-cyan-950/80 via-[#020914] to-violet-950/70 ${className}`}>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center shadow-2xl shadow-cyan-500/10">
          <p className="text-xs font-black uppercase tracking-[0.32em] text-cyan-300">Outlet Stock</p>
          <p className="mt-2 max-w-[220px] text-xl font-black text-white">{alt || "Producto"}</p>
        </div>
        {overlay && <div className="absolute inset-0 bg-gradient-to-t from-[#00060F] via-transparent to-transparent" />}
      </div>
    );
  }

  return (
    <>
      <img src={src} alt={alt} className={className} />
      {overlay && <div className="absolute inset-0 bg-gradient-to-t from-[#00060F] via-transparent to-transparent" />}
    </>
  );
}

const splashDots = [
  { x: 0, y: -31 },
  { x: 27, y: -15 },
  { x: 27, y: 15 },
  { x: 0, y: 31 },
  { x: -27, y: 15 },
  { x: -27, y: -15 }
];

function ToastStack({ items, onRemove }) {
  return (
    <div className="fixed top-24 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-3 pointer-events-none">
      <AnimatePresence initial={false}>
        {items.map((toast) => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.96 }}>
            <motion.div
              initial={{ width: 54 }}
              animate={{ width: [54, 235, 235, 54] }}
              transition={{ duration: 1.6, times: [0, 0.35, 0.75, 1], ease: "easeInOut" }}
              onAnimationComplete={() => onRemove(toast.id)}
              className="h-14 overflow-hidden rounded-full border border-emerald-300/35 bg-[#04111d]/95 shadow-2xl shadow-emerald-400/20 backdrop-blur-xl flex items-center"
            >
              <div className="relative ml-[15px] h-6 w-6 shrink-0">
                <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.9, 2.55], opacity: [1, 0.45, 0] }} transition={{ duration: 0.55 }} className="absolute inset-0 rounded-full bg-emerald-400/35" />
                <motion.div initial={{ scale: 0.65 }} animate={{ scale: [0.65, 1.08, 1], backgroundColor: "rgb(52, 211, 153)" }} transition={{ duration: 0.32 }} className="absolute inset-0 rounded-full border-2 border-emerald-300" />
                {splashDots.map((dot, i) => (
                  <motion.span key={i} initial={{ x: 0, y: 0, scale: 0, opacity: 0 }} animate={{ x: [0, dot.x], y: [0, dot.y], scale: [0, 1, 0.25], opacity: [0, 1, 0] }} transition={{ duration: 0.62, delay: 0.08 + i * 0.025 }} className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,.9)]" />
                ))}
                <svg className="absolute left-[5px] top-[6px] h-3.5 w-4 text-[#00140d]" viewBox="0 0 14 11" fill="none">
                  <motion.path d="M1 5.5L5 9.2L13 1" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.34, delay: 0.22 }} />
                </svg>
              </div>
              <motion.span initial={{ opacity: 0, x: -8 }} animate={{ opacity: [0, 1, 1, 0], x: [-8, 0, 0, 6] }} transition={{ duration: 1.4, delay: 0.3, times: [0, 0.2, 0.7, 1] }} className="ml-4 whitespace-nowrap text-sm font-black tracking-wide text-emerald-200">
                Añadido al carrito
              </motion.span>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ProductPage({ product, selectedSize, onSelectSize, onBack, onAdd, onBuyNow }) {
  if (!product) return null;

  const productUrl = `${window.location.origin}/p/${product.id}`;
  const canAdd = product.stock && (product.isFixedPrice || selectedSize);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(productUrl);
      alert("Link del producto copiado.");
    } catch {
      alert(productUrl);
    }
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative z-10 min-h-[calc(100vh-77px)] px-4 py-8"
    >
      <div className="mx-auto max-w-7xl">
        <button
          onClick={onBack}
          className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white/80 transition hover:border-cyan-300/40 hover:text-white"
        >
          ← Volver al catálogo
        </button>

        <div className="grid gap-7 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="lg:sticky lg:top-28"
          >
            <div className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/30">
              <div className="relative h-[520px] overflow-hidden bg-black/40">
                <ProductImage src={product.image} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-white/10 bg-black/55 px-4 py-2 text-xs font-black backdrop-blur">
                    {product.category}
                  </span>
                  <span
                    className={`rounded-full border px-4 py-2 text-xs font-black backdrop-blur ${
                      product.stock
                        ? "border-emerald-300/25 bg-emerald-400/15 text-emerald-300"
                        : "border-red-300/25 bg-red-400/15 text-red-300"
                    }`}
                  >
                    {product.stock ? "Disponible" : "Agotado"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {product.isFixedPrice && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm text-white/45">Precio</p>
                    <p className="mt-1 text-3xl font-black text-emerald-300">{euro(product.price)}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm text-white/45">Calificación</p>
                  <p className="mt-1 flex items-center gap-2 text-2xl font-black text-amber-300">
                    <Icon name="star" size={22} /> {product.rating}
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.32 }}
            className="rounded-[2.2rem] border border-white/10 bg-[#020914]/90 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7"
          >
            <p className="text-xs font-black uppercase tracking-[0.35em] text-cyan-300">Producto</p>
            <h2 className="mt-3 text-4xl font-black leading-tight md:text-5xl">{product.name}</h2>
            <p className="mt-5 text-base leading-relaxed text-white/60">{product.desc}</p>

            {!product.isFixedPrice && (
              <div className="mt-7 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-5">
                <p className="text-sm text-white/55">Precio</p>
                <p className="mt-1 text-3xl font-black text-emerald-300">{getProductDisplayPrice(product)}</p>
                <p className="mt-1 text-xs text-white/45">El precio cambia según la talla seleccionada.</p>
              </div>
            )}

            {!product.isFixedPrice && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-black text-white/75">Selecciona una talla</p>
                {product.sizes.length === 0 ? (
                  <p className="rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-3 text-sm text-yellow-100">
                    Este producto está marcado con precio por talla, pero no tiene tallas cargadas.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {product.sizes.map((size) => {
                      const selected = selectedSize?.id === size.id || selectedSize?.name === size.name;
                      return (
                        <button
                          key={size.id || size.name}
                          disabled={!size.stock}
                          onClick={() => onSelectSize(size)}
                          className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected
                              ? "border-emerald-300 bg-emerald-300 text-black"
                              : "border-white/10 bg-white/[0.04] hover:border-cyan-300/40"
                          }`}
                        >
                          <b className="block text-lg">{size.name}</b>
                          <span className="text-sm opacity-75">{euro(size.price || product.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-7 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-cyan-200">
                <Icon name="shield" size={18} /> Compra protegida
              </p>
              <p className="mt-1 text-sm text-white/50">Protección de envío y entrega calculadas en el carrito.</p>
            </div>

            {!canAdd && product.stock && !product.isFixedPrice && (
              <p className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm font-bold text-yellow-100">
                Primero selecciona una talla para continuar.
              </p>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => onAdd(product, product.isFixedPrice ? null : selectedSize)}
                disabled={!canAdd}
                className="rounded-2xl border border-cyan-300/35 bg-cyan-300/10 px-5 py-4 font-black text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                Añadir al carrito
              </button>
              <button
                onClick={() => onBuyNow(product, product.isFixedPrice ? null : selectedSize)}
                disabled={!canAdd}
                className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-500 px-5 py-4 font-black text-black shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Comprar
              </button>
            </div>

            <button
              onClick={copyLink}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 font-black text-white/80 transition hover:border-cyan-300/40 hover:text-white"
            >
              Copiar link del producto
            </button>
          </motion.aside>
        </div>
      </div>
    </motion.main>
  );
}

function runSelfTests() {
  const mockProduct = normalizeProduct({ id: 1, nombre: "Camisa", categoria: "Ropa", precio: 12, stock: 3 });
  const mockSized = normalizeProduct({ id: 2, nombre: "Zapatilla", tipo_precio: "por talla", product_sizes: [{ talla: "42", precio: 30 }] });
  const totals = cartTotals([{ id: 1, name: "A", price: 10, qty: 2 }]);
  const whatsappMessage = buildWhatsAppOrderMessage([{ id: 1, name: "Camisa", price: 10, qty: 2, selectedSize: "M" }], 20);
  const whatsappUrl = buildWhatsAppUrl("+34 628 24 16 16", whatsappMessage);
  const storedCart = normalizeStoredCart([{ id: 1, name: "Camisa", price: "10", qty: "2", cartId: "camisa-m" }]);

  console.assert(euro(10).includes("10"), "euro() should format numeric values");
  console.assert(mockProduct.name === "Camisa", "normalizeProduct() should map Spanish product names");
  console.assert(mockProduct.stock === true, "normalizeProduct() should convert numeric stock into boolean availability");
  console.assert(mockSized.isFixedPrice === false, "normalizeProduct() should detect variable size price");
  console.assert(mockSized.price === 30, "normalizeProduct() should use min size price for display");
  console.assert(buildCategories([mockProduct]).includes("Ropa"), "buildCategories() should include product categories");
  console.assert(filterProducts([mockProduct], "cam", "Todos").length === 1, "filterProducts() should search by product name");
  console.assert(filterProducts([mockProduct], "", "Ropa").every((p) => p.category === "Ropa"), "filterProducts() should filter by category");
  console.assert(totals.total === 20, "cartTotals() should sum only product prices and quantities");
  console.assert(cartTotals([{ price: 10, qty: 1 }, { price: 5, qty: 2 }]).total === 20, "cartTotals() should sum multiple cart items");
  console.assert(whatsappMessage.includes("*Nuevo pedido - Outlet Stock*"), "buildWhatsAppOrderMessage() should include WhatsApp bold title");
  console.assert(whatsappMessage.includes("*Talla:* M"), "buildWhatsAppOrderMessage() should include selected size");
  console.assert(whatsappUrl.startsWith("https://wa.me/34628241616?text="), "buildWhatsAppUrl() should clean phone and build wa.me URL");
  console.assert(storedCart.length === 1 && storedCart[0].qty === 2, "normalizeStoredCart() should restore persisted cart items safely");
}

if (typeof window !== "undefined" && !window.__OUTLET_STOCK_OFFICIAL_TESTED__) {
  window.__OUTLET_STOCK_OFFICIAL_TESTED__ = true;
  runSelfTests();
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState(() => loadCartFromStorage());
  const [cartOpen, setCartOpen] = useState(false);
  const [toastItems, setToastItems] = useState([]);
  const [selectedSize, setSelectedSize] = useState(null);
  const [activeProductId, setActiveProductId] = useState(() => {
    const match = window.location.pathname.match(/^\/p\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  });

  const categories = useMemo(() => buildCategories(products), [products]);
  const filteredProducts = useMemo(() => filterProducts(products, query, category), [products, query, category]);
  const { total, count } = cartTotals(cart);
  const activeProduct = useMemo(
    () => products.find((product) => String(product.id) === String(activeProductId)) || null,
    [products, activeProductId]
  );

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductError("");

      const productsResult = await fetchFirstAvailableTable(["products", "productos"], { orderBy: "created_at" });

      if (!active) return;

      if (productsResult.error) {
        setProductError(`No se pudieron cargar productos desde Supabase: ${productsResult.error.message}`);
        setProducts([]);
        setLoadingProducts(false);
        return;
      }

      const sizesResult = await fetchFirstAvailableTable(["product_sizes", "tamanos_de_producto", "tamaños_de_producto"]);

      if (!active) return;

      if (sizesResult.error) {
        setProductError(`Productos cargados, pero no se pudieron cargar tallas: ${sizesResult.error.message}`);
      }

      const normalized = mergeProductsWithSizes(productsResult.data, sizesResult.data).map(normalizeProduct);
      setProducts(normalized);
      setLoadingProducts(false);
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]);

  useEffect(() => {
    function handlePopState() {
      const match = window.location.pathname.match(/^\/p\/([^/]+)/);
      setActiveProductId(match ? decodeURIComponent(match[1]) : null);
      setSelectedSize(null);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function openProductPage(product) {
    setActiveProductId(product.id);
    setSelectedSize(null);
    window.history.pushState({}, "", `/p/${encodeURIComponent(product.id)}`);
  }

  function closePreview() {
    setActiveProductId(null);
    setSelectedSize(null);
    window.history.pushState({}, "", "/");
  }

  function buildCartItem(product, size = null) {
    const finalPrice = size ? Number(size.price || product.price) : Number(product.price);
    const cartId = size ? `${product.id}-${size.id || size.name}` : String(product.id);

    return {
      ...product,
      cartId,
      price: finalPrice,
      selectedSize: size?.name || null,
      qty: 1
    };
  }

  function addToCart(product, size = null) {
    if (!product.stock) return;

    if (!product.isFixedPrice && !size) {
      openProductPage(product);
      return;
    }

    const cartItem = buildCartItem(product, size);

    setCart((prev) => {
      const exists = prev.find((item) => item.cartId === cartItem.cartId);
      if (exists) return prev.map((item) => (item.cartId === cartItem.cartId ? { ...item, qty: item.qty + 1 } : item));
      return [...prev, cartItem];
    });

    setToastItems((prev) => [...prev, { id: Date.now() + Math.random() }].slice(-3));
    setSelectedSize(null);
  }

  function updateQty(cartId, diff) {
    setCart((prev) => prev.map((item) => (item.cartId === cartId ? { ...item, qty: item.qty + diff } : item)).filter((item) => item.qty > 0));
  }

  function continueWithOrder() {
    if (cart.length === 0) return;

    const message = buildWhatsAppOrderMessage(cart, total);
    const whatsappUrl = buildWhatsAppUrl(WHATSAPP_PHONE, message);
    const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    if (!opened) {
      window.location.href = whatsappUrl;
    }
  }

  async function buyNow(product, size = null) {
    if (!product.stock) return;
    if (!product.isFixedPrice && !size) return;

    const cartItem = buildCartItem(product, size);
    const newCart = [cartItem];

    setCart(newCart);
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#00060F] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -right-40 top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#00060F]/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Outlet Stock</p>
            <h1 className="text-2xl font-black md:text-3xl">Outlet Stock - Catálogo</h1>
          </div>
          <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-400/20">
            <Icon name="cart" size={20} />
            <span className="hidden font-semibold sm:inline">Carrito</span>
            {count > 0 && <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-emerald-400 px-1 text-xs font-black text-black">{count}</span>}
          </button>
        </div>
      </header>

      {activeProduct ? (
        <ProductPage
          product={activeProduct}
          selectedSize={selectedSize}
          onSelectSize={setSelectedSize}
          onBack={closePreview}
          onAdd={addToCart}
          onBuyNow={buyNow}
        />
      ) : activeProductId && !loadingProducts ? (
        <main className="relative z-10 mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="rounded-[2rem] border border-red-400/25 bg-red-400/10 p-8 text-red-100">
            <h2 className="text-3xl font-black">Producto no encontrado</h2>
            <p className="mt-3 text-red-100/70">El link no coincide con ningún producto disponible.</p>
            <button onClick={closePreview} className="mt-6 rounded-2xl bg-white px-5 py-3 font-black text-black">
              Volver al catálogo
            </button>
          </div>
        </main>
      ) : (
        <main className="relative z-10 mx-auto max-w-7xl px-4 py-8">
          <section className="mb-7 rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 md:p-5">
            <div className="flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto..." className="w-full rounded-2xl border border-white/10 bg-black/35 px-12 py-4 outline-none transition focus:border-cyan-300/60" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setCategory(cat)} className={`shrink-0 rounded-2xl border px-4 py-3 text-sm font-bold transition ${category === cat ? "border-cyan-300 bg-cyan-300 text-black" : "border-white/10 bg-black/25 text-white/65 hover:text-white"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {productError && <div className="mb-5 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{productError}</div>}
          {loadingProducts && <div className="mb-5 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">Cargando productos reales desde Supabase...</div>}

          {!loadingProducts && !productError && products.length === 0 && (
            <div className="rounded-[2rem] border border-yellow-300/20 bg-yellow-300/10 p-8 text-center text-yellow-100">
              <h2 className="text-2xl font-black">No hay productos publicados</h2>
              <p className="mt-3 text-yellow-100/70">Cuando agregues productos en Supabase aparecerán aquí automáticamente.</p>
            </div>
          )}

          {!loadingProducts && products.length > 0 && filteredProducts.length === 0 && (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center text-white/60">
              <h2 className="text-2xl font-black text-white">Sin resultados</h2>
              <p className="mt-3">No encontramos productos con ese filtro o búsqueda.</p>
            </div>
          )}

          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product, index) => (
              <motion.article
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => openProductPage(product)}
                className="group cursor-pointer overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.045] shadow-xl shadow-black/20 transition hover:border-cyan-300/35"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-black/40">
                  <ProductImage src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs font-bold backdrop-blur">{product.category}</span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold backdrop-blur ${product.stock ? "border-emerald-300/25 bg-emerald-400/15 text-emerald-300" : "border-red-300/25 bg-red-400/15 text-red-300"}`}>
                      {product.stock ? "Disponible" : "Agotado"}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-xl font-black leading-tight">{product.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-white/55">{product.desc}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-sm font-black text-amber-300"><Icon name="star" size={16} /> {product.rating}</div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <p className="text-2xl font-black text-emerald-300">{getProductDisplayPrice(product)}</p>
                    <button disabled={!product.stock} onClick={(e) => { e.stopPropagation(); addToCart(product); }} className="rounded-2xl bg-white px-4 py-3 font-black text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">Agregar</button>
                  </div>
                </div>
              </motion.article>
            ))}
          </section>
        </main>
      )}
      <ToastStack items={toastItems} onRemove={(id) => setToastItems((prev) => prev.filter((x) => x.id !== id))} />

      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 230 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#020914] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Pedido</p><h2 className="text-2xl font-black">Carrito</h2></div>
                <button onClick={() => setCartOpen(false)} className="rounded-xl bg-white/10 p-3 transition hover:bg-white/15"><Icon name="close" size={20} /></button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {cart.length === 0 ? (
                  <div className="grid h-full place-items-center text-center text-white/50"><div><Icon name="cart" className="mx-auto mb-3" size={26} /><p>Tu carrito está vacío.</p></div></div>
                ) : (
                  cart.map((item) => (
                    <div key={item.cartId} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <ProductImage src={item.image} alt={item.name} className="h-20 w-20 rounded-xl object-cover" overlay={false} />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-black">{item.name}</h4>
                        {item.selectedSize && <p className="text-xs text-cyan-200">Talla: {item.selectedSize}</p>}
                        <p className="font-bold text-emerald-300">{euro(item.price)}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button onClick={() => updateQty(item.cartId, -1)} className="rounded-lg bg-white/10 p-2"><Icon name="minus" size={14} /></button>
                          <span className="w-6 text-center font-black">{item.qty}</span>
                          <button onClick={() => updateQty(item.cartId, 1)} className="rounded-lg bg-white/10 p-2"><Icon name="plus" size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-4 border-t border-white/10 pt-4">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-cyan-300/[0.04] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-white">Total</span>
                    <b className="text-3xl font-black text-emerald-300">{euro(total)}</b>
                  </div>
                </div>

                <button disabled={cart.length === 0} onClick={continueWithOrder} className="w-full rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-500 py-4 font-black text-black shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] disabled:opacity-40">Continuar con Pedido</button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
