import Stripe from "https://esm.sh/stripe@14?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error("Falta STRIPE_SECRET_KEY en Supabase Secrets");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
    });

    const body = await req.json();

    if (body.action === "cancel") {
      const paymentIntentId = body.payment_intent_id;

      if (!paymentIntentId) {
        throw new Error("Falta payment_intent_id");
      }

      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

      return new Response(
        JSON.stringify({
          canceled: true,
          status: paymentIntent.status,
          id: paymentIntent.id,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Carrito vacío o inválido");
    }

    const amount = items.reduce((acc: number, item: any) => {
      return acc + Number(item.unit_price) * Number(item.quantity);
    }, 0);

    if (!amount || amount <= 0) {
      throw new Error("Monto inválido");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "eur",
      payment_method_types: ["card", "bizum"],
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
