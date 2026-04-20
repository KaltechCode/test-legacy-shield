import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildUnifiedEmail } from "../_shared/emailTemplate.ts";
import transporter from "../_shared/createTrasport.ts";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const email = body.email?.trim?.()?.toLowerCase?.();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ─── PHASE 1: Send OTP code ───
    if (action === "send_code") {
      // Check if a paid intake exists for this email
      const { data: intake, error: dbError } = await supabase
        .from("financial_stress_test_intakes")
        .select("id")
        .ilike("email", email)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError) {
        console.error("DB error:", dbError);
        return new Response(
          JSON.stringify({ error: "An error occurred. Please try again." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Always return code_sent: true to prevent email enumeration
      if (!intake) {
        return new Response(JSON.stringify({ code_sent: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate 6-digit OTP
      const otpArray = new Uint32Array(1);
      crypto.getRandomValues(otpArray);
      const otp = String(otpArray[0] % 1000000).padStart(6, "0");

      // Hash and store
      const otpHash = await sha256(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      const { error: updateError } = await supabase
        .from("financial_stress_test_intakes")
        .update({
          diagnostic_otp_hash: otpHash,
          diagnostic_otp_expires_at: expiresAt,
        })
        .eq("id", intake.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "An error occurred. Please try again." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Send OTP via Resend
      const emailFrom =
        Deno.env.get("EMAIL_FROM") ||
        "KB&K Financial <noreply@kbkfinancial.com>";

      // if (resendApiKey) {
      //   try {
      //     const emailResponse = await fetch("https://api.resend.com/emails", {
      //       method: "POST",
      //       headers: {
      //         "Content-Type": "application/json",
      //         Authorization: `Bearer ${resendApiKey}`,
      //       },
      //       body: JSON.stringify({
      //         from: emailFrom,
      //         to: [email],
      //         subject: "Your Verification Code — KB&K Financial Diagnostic",
      //         html: buildUnifiedEmail({
      //           headerSubtitle: "VERIFICATION REQUIRED",
      //           contextStatement: "Use the code below to access your Detailed Financial Diagnostic.",
      //           cardContent: `
      //             <p style="color:#718096;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px 0;text-align:center;font-weight:600;">Your Verification Code</p>
      //             <p style="font-size:42px;font-weight:800;color:#0A2240;letter-spacing:8px;font-family:'Courier New',monospace;margin:0;text-align:center;">${otp}</p>
      //             <p style="color:#D97706;font-size:13px;font-weight:600;margin:12px 0 0 0;text-align:center;">⏱ This code expires in 10 minutes</p>
      //           `,
      //           secondaryText: "If you didn't request this code, you can safely ignore this email.",
      //         }),
      //       }),
      //     });

      try {
        const emailResponse = await transporter.sendMail({
          from: emailFrom,
          to: [email],
          subject: "Your Verification Code — KB&K Financial Diagnostic",
          html: buildUnifiedEmail({
            headerSubtitle: "VERIFICATION REQUIRED",
            contextStatement:
              "Use the code below to access your Detailed Financial Diagnostic.",
            cardContent: `
                  <p style="color:#718096;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px 0;text-align:center;font-weight:600;">Your Verification Code</p>
                  <p style="font-size:42px;font-weight:800;color:#0A2240;letter-spacing:8px;font-family:'Courier New',monospace;margin:0;text-align:center;">${otp}</p>
                  <p style="color:#D97706;font-size:13px;font-weight:600;margin:12px 0 0 0;text-align:center;">⏱ This code expires in 10 minutes</p>
                `,
            secondaryText:
              "If you didn't request this code, you can safely ignore this email.",
          }),
        });

        if (!emailResponse.ok) {
          console.error("Resend error:", await emailResponse.json());
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }

      return new Response(JSON.stringify({ code_sent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ─── PHASE 2: Verify OTP code ───
    if (action === "verify_code") {
      const code = body.code?.trim?.();

      if (!code || typeof code !== "string" || code.length !== 6) {
        return new Response(
          JSON.stringify({ error: "A valid 6-digit code is required." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: intake, error: dbError } = await supabase
        .from("financial_stress_test_intakes")
        .select(
          "id, diagnostic_otp_hash, diagnostic_otp_expires_at, first_name, last_name, email, phone, marital_status, number_of_children, primary_concern, annual_income, monthly_expenses, mortgage_balance, consumer_debt, life_insurance_coverage",
        )
        .ilike("email", email)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Diagnostic logging
      console.log("[verify_code] Intake found:", !!intake);
      console.log(
        "[verify_code] OTP hash exists:",
        !!intake?.diagnostic_otp_hash,
      );
      console.log(
        "[verify_code] OTP expires_at:",
        intake?.diagnostic_otp_expires_at,
      );
      if (intake?.diagnostic_otp_expires_at) {
        console.log(
          "[verify_code] Expired:",
          new Date(intake.diagnostic_otp_expires_at) < new Date(),
        );
      }

      if (dbError) {
        console.error("DB error:", dbError);
        return new Response(
          JSON.stringify({ error: "An error occurred. Please try again." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (
        !intake ||
        !intake.diagnostic_otp_hash ||
        !intake.diagnostic_otp_expires_at
      ) {
        return new Response(
          JSON.stringify({
            verified: false,
            error: "Invalid or expired code. Please request a new one.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Check expiration
      const expiresAt = new Date(intake.diagnostic_otp_expires_at);
      if (expiresAt < new Date()) {
        return new Response(
          JSON.stringify({
            verified: false,
            error: "Code has expired. Please request a new one.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Compare hashes
      const codeHash = await sha256(code);
      const hashMatch = secureCompare(codeHash, intake.diagnostic_otp_hash);
      console.log("[verify_code] Hash comparison result:", hashMatch);
      if (!hashMatch) {
        return new Response(
          JSON.stringify({
            verified: false,
            error: "Incorrect code. Please try again.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Clear OTP after successful verification (single-use)
      await supabase
        .from("financial_stress_test_intakes")
        .update({
          diagnostic_otp_hash: null,
          diagnostic_otp_expires_at: null,
        })
        .eq("id", intake.id);

      return new Response(
        JSON.stringify({
          verified: true,
          intake_id: intake.id,
          prefill: {
            first_name: intake.first_name,
            last_name: intake.last_name,
            email: intake.email,
            phone: intake.phone,
            marital_status: intake.marital_status,
            number_of_children: intake.number_of_children,
            primary_concern: intake.primary_concern,
            annual_income: intake.annual_income,
            monthly_expenses: intake.monthly_expenses,
            mortgage_balance: intake.mortgage_balance,
            consumer_debt: intake.consumer_debt,
            life_insurance_coverage: intake.life_insurance_coverage,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({
        error: "Invalid action. Use 'send_code' or 'verify_code'.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
