import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, MapPin, User, X } from "lucide-react";

function Field({ icon: Icon, label, value, onChange, type = "text", placeholder, required = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">
        {label}{required && <span className="text-[#3FB9FF]"> *</span>}
      </span>
      <div className="relative">
        <Icon className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-[#20222A] bg-[#07080A] px-4 py-3 pl-11 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#3FB9FF]"
        />
      </div>
    </label>
  );
}

export default function AuthModal({ supabase, open, reason = "Para continuar necesitas iniciar sesión o crear una cuenta.", onClose, onSuccess }) {
  const [mode, setMode] = useState("register");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    shippingAddress: "",
    floor: "",
    door: "",
    city: "",
    postalCode: "",
  });

  const isRegister = mode === "register";
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const cleanPrefix = (value, prefix) => {
    const cleanValue = value.trim().replaceAll("  ", " ");
    const lowerValue = cleanValue.toLowerCase();
    const lowerPrefix = `${prefix.toLowerCase()} `;
    return lowerValue.startsWith(lowerPrefix) ? cleanValue.slice(prefix.length).trim() : cleanValue;
  };

  const canSubmit = useMemo(() => {
    if (!form.email || !form.password) return false;
    if (isRegister && (!form.fullName || !form.shippingAddress || !form.floor || !form.door || !form.city || !form.postalCode)) return false;
    return true;
  }, [form, isRegister]);

  async function loadProfile(user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return data || null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage({ type: "error", text: "Completa los campos obligatorios para continuar." });
      return;
    }

    setLoading(true);

    try {
      let user = null;

      if (isRegister) {
        const cleanFloor = cleanPrefix(form.floor, "piso");
        const cleanDoor = cleanPrefix(form.door, "puerta");
        const fullShippingAddress = `${form.shippingAddress.trim()}, Piso ${cleanFloor}, Puerta ${cleanDoor}`;

        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.fullName,
              phone: form.phone,
              shipping_address: fullShippingAddress,
              city: form.city,
              postal_code: form.postalCode,
            },
          },
        });

        if (error) throw error;
        user = data?.user;
        if (!user) throw new Error("No se pudo crear el usuario. Revisa la configuración de Auth en Supabase.");

        if (data?.session) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: user.id,
            full_name: form.fullName,
            phone: form.phone,
            shipping_address: fullShippingAddress,
            city: form.city,
            postal_code: form.postalCode,
            updated_at: new Date().toISOString(),
          });
          if (profileError) throw profileError;
        }

        setMessage({ type: "success", text: data?.session ? "Cuenta creada correctamente." : "Cuenta creada. Revisa tu correo para confirmar la cuenta." });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
        user = data?.user;
        setMessage({ type: "success", text: "Inicio de sesión correcto." });
      }

      if (user) {
        const profile = await loadProfile(user);
        onSuccess?.({ user, profile });
      }
    } catch (error) {
      let errorMessage = "Ocurrió un error inesperado.";
      if (error?.message?.includes("Invalid login credentials")) errorMessage = "Correo o contraseña incorrectos.";
      else if (error?.message?.includes("Email not confirmed")) errorMessage = "Debes confirmar tu correo antes de ingresar.";
      else if (error?.message?.includes("User already registered")) errorMessage = "Este correo ya está registrado.";
      else if (error?.message?.includes("Password should be at least")) errorMessage = "La contraseña debe tener al menos 6 caracteres.";
      else if (error?.message) errorMessage = error.message;
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[1.8rem] border border-[#20222A] bg-[#0B0B0D]/95 p-4 text-white shadow-2xl shadow-black/60 sm:p-6"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-zinc-400 transition hover:bg-white/15 hover:text-white" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 pr-10">
          <p className="mb-2 text-base font-black tracking-tight text-[#3FB9FF] sm:text-lg">Outlet Stock</p>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{isRegister ? "Crear cuenta" : "Iniciar sesión"}</h2>
          <p className="mt-2 text-sm text-zinc-400">{reason}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-2xl bg-[#07080A] p-1.5">
          <button type="button" onClick={() => { setMode("register"); setMessage(null); }} className={`rounded-xl px-4 py-3 text-sm font-black transition ${isRegister ? "bg-[#3FB9FF] text-black" : "text-zinc-500 hover:text-white"}`}>Registro</button>
          <button type="button" onClick={() => { setMode("login"); setMessage(null); }} className={`rounded-xl px-4 py-3 text-sm font-black transition ${!isRegister ? "bg-[#3FB9FF] text-black" : "text-zinc-500 hover:text-white"}`}>Ingresar</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {isRegister && (
              <motion.div key="register-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                <Field icon={User} label="Nombre completo" value={form.fullName} onChange={(v) => update("fullName", v)} placeholder="Ej: Juan Pérez" required />
                <Field icon={MapPin} label="Dirección para el envío" value={form.shippingAddress} onChange={(v) => update("shippingAddress", v)} placeholder="Calle, avenida y número" required />
                <div className="grid grid-cols-3 gap-3">
                  <Field icon={MapPin} label="Piso" value={form.floor} onChange={(v) => update("floor", v)} placeholder="30" required />
                  <Field icon={MapPin} label="Puerta" value={form.door} onChange={(v) => update("door", v)} placeholder="2B" required />
                  <Field icon={MapPin} label="C.P." value={form.postalCode} onChange={(v) => update("postalCode", v.replace(/[^0-9]/g, "").slice(0, 5))} placeholder="39300" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field icon={MapPin} label="Ciudad" value={form.city} onChange={(v) => update("city", v)} placeholder="Torrelavega" required />
                  <Field icon={User} label="Teléfono" value={form.phone} onChange={(v) => update("phone", v)} placeholder="612 34 56 78" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Field icon={Mail} label="Correo electrónico" value={form.email} onChange={(v) => update("email", v)} type="email" placeholder="cliente@email.com" required />

          <label className="block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-zinc-500">Contraseña <span className="text-[#3FB9FF]">*</span></span>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
              <input value={form.password} onChange={(e) => update("password", e.target.value)} type={showPassword ? "text" : "password"} placeholder="Mínimo 6 caracteres" className="w-full rounded-2xl border border-[#20222A] bg-[#07080A] px-4 py-3 pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-[#3FB9FF]" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-3.5 text-zinc-500 transition hover:text-white" aria-label="Mostrar contraseña">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <AnimatePresence>
            {message && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${message.type === "success" ? "border-green-400/20 bg-green-400/10 text-green-200" : "border-red-400/20 bg-red-400/10 text-red-200"}`}>
                {message.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertCircle className="mt-0.5 h-4 w-4" />}
                <span>{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={loading || !canSubmit} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3FB9FF] px-5 py-3 text-sm font-black text-black transition hover:bg-[#67C9FF] disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Procesando..." : isRegister ? "Crear mi cuenta" : "Ingresar a mi cuenta"}
            {!loading && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
          </button>
        </form>
      </motion.section>
    </div>
  );
}
