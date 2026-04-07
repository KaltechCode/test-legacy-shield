import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { getClientIP, applyRateLimits, RateLimitPresets, resetRateLimit } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface VerifyCodeRequest {
  email: string;
  code: string;
}

// Simple hash function for verification codes
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Rate limiting storage (in-memory for this instance)
const verificationAttempts = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of verificationAttempts.entries()) {
    if (now > value.resetAt) {
      verificationAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body once at the beginning
    const { email, code }: VerifyCodeRequest = await req.json();
    
    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and code are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Apply rate limiting: per-IP first
    const clientIP = getClientIP(req);
    
    const ipRateLimitResponse = applyRateLimits([
      {
        key: clientIP,
        config: { ...RateLimitPresets.STANDARD, keyPrefix: 'verify_code_ip' }
      }
    ], corsHeaders);
    
    if (ipRateLimitResponse) {
      return ipRateLimitResponse;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Verifying code for email:", email);

    // Per-email rate limiting: 5 attempts per email per hour
    const attemptKey = `verify_${email}`;
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;
    
    let attempts = verificationAttempts.get(attemptKey);
    if (!attempts || now > attempts.resetAt) {
      attempts = { count: 0, resetAt: now + hourInMs };
      verificationAttempts.set(attemptKey, attempts);
    }

    if (attempts.count >= 5) {
      const remainingTime = Math.ceil((attempts.resetAt - now) / 60000);
      console.log(`Rate limit exceeded for ${email}. ${attempts.count} attempts.`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Too many verification attempts. Please try again in ${remainingTime} minutes or request a new code.` 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Increment attempt counter
    attempts.count++;

    // Get the lead record
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("id, email, first_name, last_name, verification_code_hash, verification_code_expires_at")
      .eq("email", email)
      .single();

    if (fetchError || !lead) {
      console.error("Lead not found or error:", fetchError);
      // SECURITY: Generic error message to prevent email enumeration
      return new Response(
        JSON.stringify({ success: false, error: "Verification failed. Please check your code and try again." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if code is expired
    const expiresAt = new Date(lead.verification_code_expires_at);
    const currentTime = new Date();

    if (currentTime > expiresAt) {
      console.log("Code expired");
      return new Response(
        JSON.stringify({ success: false, error: "Code has expired. Please request a new one." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Hash the provided code and compare
    const hashedCode = await hashCode(code);

    if (hashedCode !== lead.verification_code_hash) {
      console.log(`Invalid code attempt for ${email}. Attempt count: ${attempts.count}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid verification code. ${5 - attempts.count} attempts remaining.` 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Clear rate limit on successful verification
    verificationAttempts.delete(attemptKey);
    resetRateLimit(email.toLowerCase(), 'verify_code_ip');

    // Mark email as verified
    const { error: updateError } = await supabase
      .from("leads")
      .update({ 
        email_verified: true,
        verification_code_hash: null,
        verification_code_expires_at: null
      })
      .eq("id", lead.id);

    if (updateError) {
      console.error("Error updating lead:", updateError);
      throw updateError;
    }

    console.log("Email verified successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        leadId: lead.id,
        email: lead.email,
        firstName: lead.first_name,
        lastName: lead.last_name
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error verifying code:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Verification failed. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
