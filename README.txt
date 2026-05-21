Outlet Stock

Para correr:
npm install
npm run dev

Cambios aplicados sobre tu copia de seguridad:
- Al cerrar la X del modal de pago, se manda cancelar el PaymentIntent a Stripe.
- El formulario de pago queda arriba.
- El resumen del pedido queda abajo.
- Se oculta la barra de scroll del modal de pago.

IMPORTANTE:
También debes actualizar tu Edge Function swift-task en Supabase con el código de:
supabase/functions/swift-task/index.ts
Luego dale Deploy updates.
