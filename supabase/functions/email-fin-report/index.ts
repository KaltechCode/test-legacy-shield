import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getClientIP, applyRateLimits, RateLimitPresets } from "../_shared/rateLimit.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { buildUnifiedEmail } from "../_shared/emailTemplate.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface EmailReportRequest {
  leadId: string;
}

// Format currency for display
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Generate email HTML from report data server-side
const generateEmailHTML = (
  firstName: string,
  inputs: Record<string, any>,
  outputs: Record<string, any>,
  scenarios: Record<string, any>[] | null
): string => {
  const hasScenarios = scenarios && scenarios.length > 0;
  
  let scenariosHtml = '';
  if (hasScenarios) {
    scenariosHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;border-collapse:collapse;">
        <tr style="background:#E2E8F0;">
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#0A2240;border-bottom:2px solid #CBD5E0;">Scenario</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#0A2240;text-align:right;border-bottom:2px solid #CBD5E0;">FIN</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#0A2240;text-align:right;border-bottom:2px solid #CBD5E0;">Monthly Savings</td>
        </tr>
        ${scenarios.map((s: any) => `
          <tr>
            <td style="padding:8px 12px;font-size:13px;color:#4A5568;border-bottom:1px solid #E2E8F0;">${s.name || 'Scenario'}</td>
            <td style="padding:8px 12px;font-size:13px;color:#0A2240;font-weight:600;text-align:right;border-bottom:1px solid #E2E8F0;">${formatCurrency(s.fin || 0)}</td>
            <td style="padding:8px 12px;font-size:13px;color:#0A2240;text-align:right;border-bottom:1px solid #E2E8F0;">${formatCurrency(s.monthlySavings || 0)}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  const cardContent = `
    <p style="color:#718096;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 16px 0;text-align:center;font-weight:600;">Your Financial Independence Number</p>
    <p style="font-size:36px;font-weight:800;color:#0A2240;margin:0;text-align:center;">${formatCurrency(outputs.finTargetAtRet || 0)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
      <tr>
        <td style="padding:8px 0;color:#718096;font-size:14px;">Monthly Savings Required</td>
        <td style="padding:8px 0;color:#38B2ED;font-size:16px;font-weight:700;text-align:right;">${formatCurrency(outputs.monthlyNeeded || 0)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#718096;font-size:14px;">Years to Financial Independence</td>
        <td style="padding:8px 0;color:#0A2240;font-size:16px;font-weight:700;text-align:right;">${outputs.yearsUntil || 0} years</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#718096;font-size:14px;">Target Retirement Age</td>
        <td style="padding:8px 0;color:#0A2240;font-size:14px;text-align:right;">${inputs.retireAge || 65}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#718096;font-size:14px;">Desired Annual Income</td>
        <td style="padding:8px 0;color:#0A2240;font-size:14px;text-align:right;">${formatCurrency((inputs.desiredMonthly || 0) * 12)}</td>
      </tr>
    </table>
    ${scenariosHtml}
  `;

  const bookingUrl = "https://tidycal.com/kingsley-ekinde/30-minute-meeting-1vr60yy";

  return buildUnifiedEmail({
    headerSubtitle: "FINANCIAL REPORT",
    firstName,
    contextStatement: "Your personalized Financial Independence Number report is ready for review.",
    cardContent,
    interpretation: "Your FIN represents the total capital needed to sustain your desired lifestyle through retirement. Understanding this number is the first step toward building a clear, actionable plan.",
    ctaText: "Schedule My Consultation",
    ctaUrl: bookingUrl,
    secondaryText: "Ready to take the next step in securing your financial future? A complimentary consultation can help you build a roadmap.",
  });
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId }: EmailReportRequest = await req.json();

    // Validate leadId is provided
    if (!leadId) {
      console.error("Missing leadId in request");
      return new Response(
        JSON.stringify({ success: false, error: "Lead ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate leadId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(leadId)) {
      console.error("Invalid leadId format:", leadId);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid lead ID format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Apply rate limiting
    const clientIP = getClientIP(req);
    const rateLimitResponse = applyRateLimits([
      {
        key: clientIP,
        config: { ...RateLimitPresets.STANDARD, keyPrefix: 'email_report_ip' }
      }
    ], corsHeaders);
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify lead exists and email is verified
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, email, first_name, email_verified")
      .eq("id", leadId)
      .maybeSingle();

    if (leadError) {
      console.error("Error fetching lead:", leadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to verify lead" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!lead) {
      console.error("Lead not found:", leadId);
      return new Response(
        JSON.stringify({ success: false, error: "Lead not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!lead.email_verified) {
      console.error("Lead email not verified:", leadId);
      return new Response(
        JSON.stringify({ success: false, error: "Email not verified" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch the most recent FIN report for this lead
    const { data: report, error: reportError } = await supabase
      .from("fin_reports")
      .select("inputs_json, outputs_json, scenarios_json")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) {
      console.error("Error fetching report:", reportError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch report data" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!report) {
      console.error("No report found for lead:", leadId);
      return new Response(
        JSON.stringify({ success: false, error: "No report found for this lead" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending FIN report email to:", lead.email);

    // Generate HTML server-side from verified report data
    const emailHTML = generateEmailHTML(
      lead.first_name,
      report.inputs_json as Record<string, any>,
      report.outputs_json as Record<string, any>,
      report.scenarios_json as Record<string, any>[] | null
    );

    const emailResponse = await resend.emails.send({
      from: Deno.env.get("EMAIL_FROM") ?? "KB&K Legacy Shield <no-reply@kbklegacyshield.com>",
      to: [lead.email],
      subject: "Your Financial Independence Number Report",
      html: emailHTML,
      reply_to: Deno.env.get("EMAIL_REPLY_TO") ?? "support@kbklegacyshield.com",
    });

    console.log("Report email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending report email:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get("origin")) } }
    );
  }
};

serve(handler);
