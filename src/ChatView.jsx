import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCheck, CheckCircle2, CreditCard, Landmark, Send, ShieldCheck, ShoppingBag, Store, Wallet } from "lucide-react";

const PENDING_ORDER_STORAGE_KEY = "outlet_stock_pending_order_v2";

function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
}

function nowTime() {
  return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getDisplayName(profile, user) {
  return (
    profile?.full_name ||
    profile?.name ||
    profile?.nombre ||
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Cliente"
  );
}

function normalizeMessage(message = {}) {
  return {
    id: message.id || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender: message.sender || "customer",
    type: message.type || null,
    text: message.text || "",
    time: message.time || nowTime(),
    items: Array.isArray(message.items) ? message.items : undefined,
    buttons: Array.isArray(message.buttons) ? message.buttons : undefined,
    paymentCard: message.paymentCard || undefined,
    customerName: message.customerName || undefined,
    orderSignature: message.orderSignature || undefined,
  };
}

function messageFromDb(row) {
  const raw = row?.content ?? row?.message ?? row?.text ?? row?.body ?? row?.metadata?.json ?? row;
  let parsed = null;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw };
    }
  } else if (raw && typeof raw === "object") {
    parsed = raw;
  }

  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const sender = parsed?.sender || metadata.sender || row?.sender || (row?.sender_id ? "customer" : "admin");
  const type = parsed?.type || metadata.type || row?.type || null;

  return normalizeMessage({
    ...parsed,
    id: row?.id || parsed?.id,
    sender,
    type,
    text: parsed?.text || (typeof raw === "string" && raw.startsWith("{") ? "" : parsed?.text) || "",
    time: parsed?.time || (row?.created_at ? new Date(row.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : nowTime()),
    items: parsed?.items || metadata.items,
    buttons: parsed?.buttons || metadata.buttons,
    paymentCard: parsed?.paymentCard || metadata.paymentCard,
    customerName: parsed?.customerName || metadata.customerName,
    orderSignature: parsed?.orderSignature || metadata.orderSignature,
  });
}

function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: item.id || item.cartId || `${item.name || "producto"}-${item.size || item.selectedSize || "unica"}`,
      name: item.name || "Producto sin nombre",
      size: item.size || item.selectedSize || "Única",
      qty: Math.max(1, Number(item.qty) || 1),
      price: Number(item.price) || 0,
      image: item.image || "",
    }))
    .filter((item) => item.name);
}

function orderSignature(items) {
  const normalized = normalizeOrderItems(items);
  return JSON.stringify(normalized.map((item) => ({ id: item.id, name: item.name, size: item.size, qty: item.qty, price: item.price })));
}

function readPendingOrderItems(cartItems) {
  const fromProps = normalizeOrderItems(cartItems);
  if (fromProps.length > 0) return fromProps;

  try {
    const raw = window.sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeOrderItems(parsed?.items || parsed);
  } catch {
    return [];
  }
}

function clearPendingOrderItems() {
  try {
    window.sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {}
}

const paymentMethods = {
  Bizum: {
    title: "Método de pago: Bizum",
    logo: "https://iili.io/BphuKB4.png",
    fields: [
      { label: "Titular", value: "Outlet Stock" },
      { label: "Número", value: "+34 600 000 000" },
    ],
  },
  PayPal: {
    title: "Método de pago: PayPal",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Paypal_2014_logo.png",
    fields: [
      { label: "Cuenta", value: "pagos@outletstock.app" },
      { label: "Titular", value: "Outlet Stock" },
    ],
  },
  Transferencia: {
    title: "Método de pago: Transferencia",
    logo: "https://cdn-icons-png.flaticon.com/512/2830/2830284.png",
    fields: [
      { label: "Titular", value: "Outlet Stock" },
      { label: "IBAN", value: "ES00 0000 0000 0000 0000" },
      { label: "Banco", value: "Banco Santander" },
    ],
  },
};

function detectPaymentMethod(text) {
  const clean = String(text || "").toLowerCase();
  if (clean.includes("bizum")) return "Bizum";
  if (clean.includes("paypal") || clean.includes("pay pal")) return "PayPal";
  if (clean.includes("transferencia") || clean.includes("iban") || clean.includes("banco")) return "Transferencia";
  return null;
}

function buildOrderMessages(items, customerName) {
  const normalized = normalizeOrderItems(items);
  const signature = orderSignature(normalized);
  return [
    normalizeMessage({ sender: "customer", type: "order", items: normalized, customerName, orderSignature: signature }),
    normalizeMessage({ sender: "admin", text: "Hola 👋 gracias por tu pedido. ¿Qué método de pago quieres usar?", buttons: ["Bizum", "PayPal", "Transferencia"] }),
  ];
}

function OrderReceipt({ message }) {
  const items = normalizeOrderItems(message.items || []);
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex justify-end">
      <div className="w-full max-w-[88%] rounded-3xl rounded-br-md border border-cyan-400/30 bg-cyan-400/15 p-3 text-white shadow-lg shadow-cyan-500/10 md:max-w-[72%]">
        <div className="mb-3 flex items-center gap-2 border-b border-cyan-300/20 pb-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-cyan-400 text-[#020817]"><ShoppingBag className="h-5 w-5" /></div>
          <div><p className="text-sm font-black">Pedido enviado</p><p className="text-[11px] text-cyan-100/80">Boleta automática desde el carrito</p></div>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.id}-${item.size}`} className="flex gap-3 rounded-2xl bg-[#020817]/45 p-2">
              {item.image ? <img src={item.image} alt={item.name} className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-950/80 to-violet-950/70"><span className="text-[8px] font-black uppercase tracking-widest text-cyan-300">OS</span></div>}
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.name}</p><p className="text-[11px] text-cyan-100/75">Talla {item.size} · Cant. {item.qty}</p></div>
              <p className="text-xs font-black">{formatPrice(item.price * item.qty)}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-[#020817]/60 p-3 text-xs"><div className="flex justify-between text-base font-black"><span>Total</span><span>{formatPrice(total)}</span></div></div>
        <div className="mt-2 text-right text-[10px] text-cyan-100/70">{message.time}</div>
      </div>
    </motion.div>
  );
}

function PaymentCard({ card, onConfirmPayment, paymentConfirmed }) {
  return (
    <div className="mt-3 overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#020817]/70">
      <div className="flex gap-3 p-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2"><img src={card.logo} alt={card.title} className="max-h-full max-w-full object-contain" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-cyan-100">{card.title}</p>
          <div className="mt-2 space-y-1">{card.fields.map((field) => <div key={field.label} className="text-xs"><span className="font-bold text-cyan-200">{field.label}: </span><span className="break-all text-zinc-200">{field.value}</span></div>)}</div>
        </div>
      </div>
      {!paymentConfirmed && <div className="border-t border-cyan-400/10 p-3 pt-0"><button onClick={onConfirmPayment} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-[#020817] shadow-lg shadow-cyan-500/20 transition active:scale-95"><CheckCircle2 className="h-5 w-5" />Pago confirmado</button></div>}
    </div>
  );
}

function MessageBubble({ message, onSelectPayment, onConfirmPayment, paymentConfirmed }) {
  const mine = message.sender === "customer";
  if (message.type === "order") return <OrderReceipt message={message} />;
  if (message.type === "payment_confirmed") {
    return <motion.div initial={{ opacity: 0, y: 18, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex justify-center"><div className="w-full max-w-sm px-4 py-5 text-white"><div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-cyan-400 text-[#020817] shadow-2xl shadow-cyan-500/30"><CheckCircle2 className="h-8 w-8" /></div><p className="text-center text-xl font-black">Pago confirmado</p><p className="mt-2 text-center text-sm leading-relaxed text-cyan-100/90">Gracias por tu compra. Ahora verificaremos el pago con Outlet Stock.</p><div className="mt-4 text-center text-[10px] text-cyan-100/60">{message.time}</div></div></motion.div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={classNames("flex", mine ? "justify-end" : "justify-start")}>
      <div className={classNames("max-w-[82%] rounded-3xl px-4 py-3 shadow-lg", mine ? "rounded-br-md border border-cyan-400/30 bg-cyan-400/15 text-white shadow-cyan-500/10" : "rounded-bl-md border border-white/10 bg-[#0b1727] text-zinc-100 shadow-black/20")}>
        {message.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>}
        {message.paymentCard && <PaymentCard card={message.paymentCard} onConfirmPayment={onConfirmPayment} paymentConfirmed={paymentConfirmed} />}
        {message.buttons && !paymentConfirmed && <div className="mt-3 grid gap-2">{message.buttons.map((button) => { const Icon = button === "Bizum" ? Wallet : button === "PayPal" ? CreditCard : Landmark; return <button key={button} onClick={() => onSelectPayment(button)} className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/20"><Icon className="h-4 w-4" />{button}</button>; })}</div>}
        <div className={classNames("mt-2 flex items-center gap-1 text-[10px]", mine ? "justify-end text-cyan-100/80" : "text-zinc-400")}><span>{message.time}</span>{mine && <CheckCheck className="h-3 w-3" />}</div>
      </div>
    </motion.div>
  );
}

function HiddenScrollbarStyles() {
  return <style>{`.chat-scroll{scrollbar-width:none;-ms-overflow-style:none}.chat-scroll::-webkit-scrollbar{display:none}`}</style>;
}

function SystemLoadingView({ text = "Cargando chat..." }) {
  return <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(0,224,255,0.12),transparent_35%),linear-gradient(135deg,#020817,#031525,#020617)] p-6 text-white"><div className="rounded-3xl border border-cyan-500/10 bg-[#020817]/80 p-8 text-center shadow-2xl shadow-cyan-500/10"><p className="text-xl font-black">{text}</p><p className="mt-2 text-sm text-cyan-100/70">Estamos recuperando tu conversación.</p></div></div>;
}

export default function ChatView({ cartItems = [], onBack, supabase, user, profile }) {
  if (!user) return <SystemLoadingView text="Validando sesión..." />;
  return <ChatViewInner cartItems={cartItems} onBack={onBack} supabase={supabase} user={user} profile={profile} />;
}

function ChatViewInner({ cartItems, onBack, supabase, user, profile }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [loadingChat, setLoadingChat] = useState(true);
  const [storageWarning, setStorageWarning] = useState("");
  const messagesContainerRef = useRef(null);
  const processedOrdersRef = useRef(new Set());
  const customerName = useMemo(() => getDisplayName(profile, user), [profile, user]);

  const saveLocalBackup = useCallback(() => {
    // El chat NO se guarda en localStorage.
    // Supabase es la única fuente de verdad para que admin y cliente vean lo mismo.
  }, []);

  async function ensureConversation() {
    if (!supabase || !user?.id) return null;

    const existingQueries = [
      () => supabase.from("conversations").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      () => supabase.from("conversations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ];

    for (const run of existingQueries) {
      const result = await run();
      if (!result.error && result.data?.id) return result.data;
    }

    const insertPayloads = [
      { customer_id: user.id, status: "open" },
      { customer_id: user.id },
      { user_id: user.id, status: "open" },
      { user_id: user.id },
    ];

    for (const payload of insertPayloads) {
      const created = await supabase.from("conversations").insert(payload).select("*").single();
      if (!created.error) return created.data;
      const msg = String(created.error.message || "").toLowerCase();
      if (!(msg.includes("column") || msg.includes("schema") || msg.includes("null value") || msg.includes("violates"))) break;
    }

    setStorageWarning("No pude crear o leer la conversación en Supabase. Revisa las policies RLS de conversations/messages.");
    return null;
  }

  async function saveMessage(conversationIdToUse, message) {
    const msg = normalizeMessage({
      ...message,
      customerName: message.customerName || (message.sender === "customer" ? customerName : undefined),
    });

    if (!supabase || !conversationIdToUse || !user?.id) return null;

    // Tu tabla public.messages tiene exactamente estas columnas:
    // id, conversation_id, sender_id, body, created_at.
    // Por eso guardamos toda la información visual del chat como JSON dentro de body.
    // sender_id se deja siempre como el usuario actual para que las policies RLS típicas
    // (sender_id = auth.uid()) permitan guardar también los mensajes automáticos del bot.
    const payload = {
      conversation_id: conversationIdToUse,
      sender_id: user.id,
      body: JSON.stringify(msg),
    };

    const result = await supabase.from("messages").insert(payload).select("*").single();

    if (!result.error) {
      setStorageWarning("");
      return result.data;
    }

    setStorageWarning(
      `No pude guardar en Supabase: ${result.error.message}. Revisa las policies RLS de conversations/messages.`
    );
    return null;
  }

  async function addMessage(message, persist = true) {
    const localMessage = normalizeMessage({ ...message, customerName: message.customerName || (message.sender === "customer" ? customerName : undefined) });

    setMessages((prev) => {
      const next = [...prev, localMessage];
      saveLocalBackup(next);
      return next;
    });

    if (persist) await saveMessage(conversationId, localMessage);
    return localMessage;
  }

  useEffect(() => {
    let active = true;
    async function loadChat() {
      setLoadingChat(true);
      const conversation = await ensureConversation();
      if (!active) return;

      setConversationId(conversation?.id || null);
      let loaded = [];

      if (conversation?.id) {
        const result = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true });
        if (!result.error) loaded = (result.data || []).map(messageFromDb);
      }

      if (loaded.length === 0) loaded = [normalizeMessage({ id: "welcome", sender: "admin", text: "Hola 👋 Soy Outlet Stock. Puedes escribirnos por aquí. Si vienes desde Continuar con Pedido, se enviará tu carrito automáticamente." })];

      processedOrdersRef.current = new Set(loaded.filter((message) => message.type === "order" && message.orderSignature).map((message) => message.orderSignature));
      setMessages(loaded);
      setLoadingChat(false);
    }
    loadChat();
    return () => { active = false; };
  }, [supabase, user?.id]);

  useEffect(() => {
    if (loadingChat) return;
    const orderItems = readPendingOrderItems(cartItems);
    if (!orderItems.length) return;

    const signature = orderSignature(orderItems);
    if (processedOrdersRef.current.has(signature)) {
      clearPendingOrderItems();
      return;
    }

    processedOrdersRef.current.add(signature);
    const orderMessages = buildOrderMessages(orderItems, customerName);
    (async () => {
      for (const message of orderMessages) await addMessage(message, true);
      clearPendingOrderItems();
    })();
  }, [loadingChat, cartItems, customerName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }, 120);
    return () => clearTimeout(timer);
  }, [messages]);

  async function sendMessage(text) {
    const clean = text.trim();
    if (!clean) return;
    setDraft("");
    await addMessage({ sender: "customer", text: clean });

    if (paymentConfirmed) setTimeout(() => addMessage({ sender: "admin", text: "Perfecto 👌 Estamos verificando el pago con el área correspondiente. Espera un momento por favor." }), 1200);

    const method = detectPaymentMethod(clean);
    if (method && !paymentConfirmed) setTimeout(() => addMessage({ sender: "admin", paymentCard: paymentMethods[method], isPaymentInfo: true }), 900);
  }

  async function handlePayment(method) {
    if (paymentConfirmed) return;
    await addMessage({ sender: "customer", text: method, isUpdatedPayment: true });
    setTimeout(() => addMessage({ sender: "admin", paymentCard: paymentMethods[method], isPaymentInfo: true }), 800);
  }

  async function confirmPayment() {
    if (paymentConfirmed) return;
    setPaymentConfirmed(true);
    await addMessage({ sender: "admin", type: "payment_confirmed" });
    setTimeout(() => addMessage({ sender: "admin", text: "Perfecto. Para verificar el pago, dime por favor a qué nombre fue realizado o cuál es el titular que aparece en el comprobante." }), 800);
  }

  if (loadingChat) return <SystemLoadingView />;

  return (
    <>
      <HiddenScrollbarStyles />
      <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(0,224,255,0.12),transparent_35%),linear-gradient(135deg,#020817,#031525,#020617)] text-white">
        <div className="mx-auto flex h-screen max-w-3xl flex-col border-x border-cyan-500/10 bg-[#020817]/40 shadow-2xl shadow-cyan-500/10">
          <header className="sticky top-0 z-20 border-b border-cyan-500/10 bg-[#020817]/90 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/20" aria-label="Volver al catálogo"><ArrowLeft className="h-5 w-5" /></button>
              <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-400/20 bg-[#050b16] shadow-lg shadow-cyan-500/10"><Store className="h-6 w-6 text-cyan-200" /><span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-cyan-400 ring-2 ring-[#020817]" /></div>
              <div className="min-w-0"><p className="truncate text-base font-black">Outlet Stock</p><p className="truncate text-xs text-cyan-200/80">En línea · conversación de {customerName}</p></div>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col">
            <div ref={messagesContainerRef} className="chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5 scroll-smooth">
              <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-cyan-500/10 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-100"><ShieldCheck className="h-4 w-4" />Chat seguro con Outlet Stock</div>
              {storageWarning && <div className="mx-auto mb-3 max-w-md rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-xs text-yellow-100">{storageWarning}</div>}
              <AnimatePresence initial={false}>
                {messages.map((message, index) => (
                  <div key={message.id || index}>
                    {message.sender === "customer" && <p className="mb-1 mr-2 text-right text-[11px] font-black text-cyan-200/80">{message.customerName || customerName}</p>}
                    <MessageBubble message={message} onSelectPayment={handlePayment} onConfirmPayment={confirmPayment} paymentConfirmed={paymentConfirmed} />
                  </div>
                ))}
              </AnimatePresence>
            </div>

            <footer className="sticky bottom-0 border-t border-cyan-500/10 bg-[#020817]/90 p-3 backdrop-blur-xl">
              <div className="flex items-end gap-3 rounded-3xl border border-cyan-500/10 bg-[#081320] p-2 shadow-xl shadow-cyan-500/10">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(draft); } }} rows={1} placeholder="Escribe un mensaje..." className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-1 py-3 text-sm text-white outline-none placeholder:text-zinc-500" />
                <button onClick={() => sendMessage(draft)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400 text-[#020817] shadow-lg shadow-cyan-500/20 transition active:scale-95"><Send className="h-5 w-5" /></button>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
