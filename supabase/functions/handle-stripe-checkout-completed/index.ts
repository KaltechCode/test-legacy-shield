import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { buildUnifiedEmail } from "../_shared/emailTemplate.ts";
import transporter from "../_shared/createTrasport.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_FROM =
  Deno.env.get("EMAIL_FROM") ||
  "KB&K Legacy Shield <no-reply@kbklegacyshield.com>";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// async function verifyStripeSignature(
//   payload: string,
//   sigHeader: string,
//   secret: string,
// ): Promise<boolean> {
//   const parts = sigHeader.split(",");
//   const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
//   const signatures = parts
//     .filter((p) => p.startsWith("v1="))
//     .map((p) => p.split("=")[1]);

//   if (!timestamp || signatures.length === 0) return false;

//   // Reject if timestamp is older than 5 minutes
//   const now = Math.floor(Date.now() / 1000);
//   if (Math.abs(now - parseInt(timestamp)) > 300) return false;

//   const signedPayload = `${timestamp}.${payload}`;
//   const key = await crypto.subtle.importKey(
//     "raw",
//     new TextEncoder().encode(secret),
//     { name: "HMAC", hash: "SHA-256" },
//     false,
//     ["sign"],
//   );
//   const signatureBytes = await crypto.subtle.sign(
//     "HMAC",
//     key,
//     new TextEncoder().encode(signedPayload),
//   );
//   const expectedSig = Array.from(new Uint8Array(signatureBytes))
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");

//   return signatures.some((s) => s === expectedSig);
// }

function formatCurrency(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

Deno.serve(async (req) => {
  // Stripe webhooks are POST only — no CORS needed
  const origin = req.headers.get("origin");
  console.log("Request origin:", origin);
  const corsHeaders = getCorsHeaders(origin);
  console.log("CORS headers:", corsHeaders);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let event;
  try {
    const body = await req.json();
    event = body.eventData ?? body;
  } catch (err) {
    console.error("Failed to parse JSON body:", err);
    return new Response("Invalid JSON", {
      status: 400,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  }

  // Only handle checkout.session.completed
  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const session = event.data.object;
  const sessionId = session.id;

  // --- Idempotency check ---
  const { data: existing } = await supabaseAdmin
    .from("stripe_checkout_events")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    console.log(`Session ${sessionId} already processed. Skipping.`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // --- Normalize data ---
  const customerName = session.customer_details?.name || "Valued Client";
  const customerEmail = session.customer_details?.email;
  const amountTotal = session.amount_total || 0;
  const currency = session.currency || "usd";
  const productName =
    session.metadata?.product_name || "From Fragile to Fortified";
  const paymentStatus = session.payment_status;

  if (!customerEmail) {
    console.error("No customer email found in session:", sessionId);
    // Still store event but mark email as not sent
    await supabaseAdmin.from("stripe_checkout_events").insert({
      session_id: sessionId,
      customer_name: customerName,
      customer_email: null,
      product_name: productName,
      amount_paid: amountTotal,
      currency,
      email_sent: false,
    });
    return new Response(JSON.stringify({ received: true, email: false }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // --- Store event (idempotency record) ---
  const { error: insertError } = await supabaseAdmin
    .from("stripe_checkout_events")
    .insert({
      session_id: sessionId,
      customer_name: customerName,
      customer_email: customerEmail,
      product_name: productName,
      amount_paid: amountTotal,
      currency,
      email_sent: false,
    });

  if (insertError) {
    // Unique constraint violation = already processed
    if (insertError.code === "23505") {
      console.log(`Duplicate insert for session ${sessionId}. Skipping.`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.error("Error inserting checkout event:", insertError);
  }

  // --- Send confirmation email via Resend ---
  let emailSent = false;
  try {
    const firstName = customerName.split(" ")[0];
    const formattedAmount = formatCurrency(amountTotal, currency);

    const cardContent = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding-bottom:16px;">
            <p style="color:#718096;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0;font-weight:600;">Product</p>
            <p style="color:#1E2A4A;font-size:17px;font-weight:700;margin:0;">${productName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;">
            <p style="color:#718096;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0;font-weight:600;">Amount Paid</p>
            <p style="color:#1E2A4A;font-size:22px;font-weight:700;margin:0;">${formattedAmount}</p>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;">
            <p style="color:#718096;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0;font-weight:600;">Payment Status</p>
            <p style="color:#38A169;font-size:16px;font-weight:700;margin:0;">✓ Confirmed</p>
          </td>
        </tr>
        <tr>
          <td>
            <p style="color:#718096;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px 0;font-weight:600;">Estimated Delivery</p>
            <p style="color:#1E2A4A;font-size:15px;font-weight:600;margin:0;">5–10 business days</p>
          </td>
        </tr>
      </table>
    `;

    const emailHtml = buildUnifiedEmail({
      headerSubtitle: "ORDER CONFIRMATION",
      firstName,
      contextStatement:
        "Your order has been successfully processed and is now being prepared.",
      cardContent,
      interpretation:
        "Your purchase is a step toward strengthening your financial foundation. We look forward to supporting your journey.",
      ctaText: "Schedule Your Consultation",
      ctaUrl: "https://tidycal.com/kingsley-ekinde/30-minute-meeting-1vr60yy",
      secondaryText:
        "A member of our team is available if you have any questions about your order.",
    });

    // const resendResponse = await fetch("https://api.resend.com/emails", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${RESEND_API_KEY}`,
    //   },
    //   body: JSON.stringify({
    //     from: EMAIL_FROM,
    //     to: [customerEmail],
    //     subject: `Order Confirmed — ${productName}`,
    //     html: emailHtml,
    //   }),
    // });

    const emailResponse = await transporter.sendMail({
      from: EMAIL_FROM,
      to: customerEmail,
      subject: "Verify Your Email - KB&K Legacy Shield",
      html: emailHtml,
    });

    if (emailResponse.messageId) {
      emailSent = true;
      console.log(
        `Confirmation email sent to ${customerEmail} for session ${sessionId}`,
      );
    } else {
      console.error("Email transport error: No messageId returned");
    }
  } catch (emailError) {
    console.error("Failed to send confirmation email:", emailError);
  }

  // --- Update email_sent status ---
  if (emailSent) {
    await supabaseAdmin
      .from("stripe_checkout_events")
      .update({ email_sent: true })
      .eq("session_id", sessionId);
  }

  // --- Log to email_delivery_logs ---
  try {
    await supabaseAdmin.from("email_delivery_logs").insert({
      email_type: "order_confirmation",
      recipient: customerEmail,
      status: emailSent ? "sent" : "failed",
      error_message: emailSent ? null : "Email send failed — see function logs",
    });
  } catch (logErr) {
    console.error("Failed to log email delivery:", logErr);
  }

  // Always return 200 to Stripe
  return new Response(
    JSON.stringify({ received: true, email_sent: emailSent }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
});
