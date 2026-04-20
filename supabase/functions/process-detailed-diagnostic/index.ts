import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  buildUnifiedEmail,
  buildAdminNotificationEmail,
} from "../_shared/emailTemplate.ts";

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import transporter from "../_shared/createTrasport.ts";

// ── Scoring Engine (server-side only) ──

function scoreIncomeStability(d: Record<string, number>): number {
  const takeHome = d.monthly_take_home_income;
  if (takeHome <= 0) return 0;
  const ratio =
    (d.monthly_essential_expenses + d.monthly_lifestyle_expenses) / takeHome;
  if (ratio <= 0.5) return 100;
  if (ratio <= 0.65) return 75;
  if (ratio <= 0.8) return 50;
  if (ratio <= 0.95) return 25;
  return 0;
}

function scoreProtection(d: Record<string, number>): number {
  const totalDebt =
    d.mortgage_balance +
    d.total_consumer_debt +
    d.student_loans +
    d.credit_card_debt;
  const annualIncome =
    d.client_annual_gross_income + d.spouse_annual_gross_income;
  const required = totalDebt + annualIncome * d.income_replacement_years;
  if (required <= 0) return 100;
  const actual = d.life_insurance_client + d.life_insurance_spouse;
  const ratio = actual / required;
  if (ratio >= 1.0) return 100;
  if (ratio >= 0.75) return 75;
  if (ratio >= 0.5) return 50;
  if (ratio >= 0.25) return 25;
  return 0;
}

function scoreLiquidity(d: Record<string, number>): number {
  const essential = d.monthly_essential_expenses;
  if (essential <= 0) return 100;
  const liquid = d.emergency_fund_balance + d.other_liquid_savings;
  const months = liquid / essential;
  if (months >= 6) return 100;
  if (months >= 4) return 75;
  if (months >= 2) return 50;
  if (months >= 1) return 25;
  return 0;
}

function scoreRetirement(d: Record<string, number>): number {
  const required = d.desired_monthly_retirement_income * 12 * 25;
  if (required <= 0) return 100;
  const ratio = d.total_retirement_savings / required;
  if (ratio >= 0.75) return 100;
  if (ratio >= 0.5) return 75;
  if (ratio >= 0.25) return 50;
  if (ratio >= 0.1) return 25;
  return 0;
}

function classify(score: number): string {
  if (score >= 80) return "Structurally Stable";
  if (score >= 60) return "Moderate Vulnerability";
  if (score >= 40) return "Elevated Risk";
  return "Financially Fragile";
}

function buildAdminEmailHTML(
  firstName: string,
  lastName: string,
  email: string,
  pillarScores: Record<string, number>,
  totalScore: number,
  classification: string,
  ratios: Record<string, number>,
): string {
  return buildAdminNotificationEmail({
    title: "New Detailed Diagnostic Submitted",
    subtitle: "ADMIN NOTIFICATION",
    bodyHtml: `
      <p style="color:#1E2A4A;font-size:16px;font-weight:700;margin:0 0 16px;">Client: ${firstName} ${lastName}</p>
      <p style="color:#4A5568;font-size:14px;margin:0 0 4px;">Email: ${email}</p>
      <p style="color:#4A5568;font-size:14px;margin:0 0 20px;">Classification: <strong>${classification}</strong></p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
        <tr style="background:#F7FAFC;">
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1E2A4A;">Pillar</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1E2A4A;text-align:right;">Score</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1E2A4A;text-align:right;">Weight</td>
        </tr>
        <tr><td style="padding:8px 12px;font-size:13px;color:#4A5568;">Income Stability</td><td style="padding:8px 12px;text-align:right;font-size:13px;">${pillarScores.income}/100</td><td style="padding:8px 12px;text-align:right;font-size:13px;">25%</td></tr>
        <tr style="background:#F7FAFC;"><td style="padding:8px 12px;font-size:13px;color:#4A5568;">Protection Coverage</td><td style="padding:8px 12px;text-align:right;font-size:13px;">${pillarScores.protection}/100</td><td style="padding:8px 12px;text-align:right;font-size:13px;">30%</td></tr>
        <tr><td style="padding:8px 12px;font-size:13px;color:#4A5568;">Liquidity & Resilience</td><td style="padding:8px 12px;text-align:right;font-size:13px;">${pillarScores.liquidity}/100</td><td style="padding:8px 12px;text-align:right;font-size:13px;">20%</td></tr>
        <tr style="background:#F7FAFC;"><td style="padding:8px 12px;font-size:13px;color:#4A5568;">Retirement Alignment</td><td style="padding:8px 12px;text-align:right;font-size:13px;">${pillarScores.retirement}/100</td><td style="padding:8px 12px;text-align:right;font-size:13px;">25%</td></tr>
        <tr><td colspan="3" style="border-top:2px solid #1E2A4A;padding:10px 12px;font-size:14px;font-weight:700;color:#1E2A4A;">Weighted Total: ${totalScore.toFixed(1)}/100</td></tr>
      </table>
      <p style="color:#718096;font-size:12px;margin:16px 0 0;">Key Ratios — Essential Expense: ${(ratios.essential_expense_ratio * 100).toFixed(1)}% | Debt-to-Income: ${(ratios.debt_ratio * 100).toFixed(1)}% | Liquidity: ${ratios.liquidity_months.toFixed(1)} mo | Protection: ${(ratios.protection_ratio * 100).toFixed(1)}% | Retirement Funding: ${(ratios.retirement_funding_ratio * 100).toFixed(1)}%</p>
      <p style="color:#718096;font-size:12px;margin:12px 0 0;">This diagnostic is pending manual review before the report is sent to the client.</p>
    `,
  });
}

function buildUserConfirmationEmailHTML(firstName: string): string {
  const bookingUrl =
    "https://tidycal.com/kingsley-ekinde/30-minute-meeting-1vr60yy";

  return buildUnifiedEmail({
    headerSubtitle: "SUBMISSION CONFIRMED",
    firstName,
    contextStatement:
      "Thank you for completing your comprehensive Financial Stress Diagnostic. We have successfully received your submission and your personalized detailed report is now being prepared.",
    cardContent: `
      <p style="color:#0A2240;font-size:16px;font-weight:700;margin:0 0 16px;">What happens next:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:6px 0;color:#4A5568;font-size:14px;">✓ Our team will review your diagnostic data</td></tr>
        <tr><td style="padding:6px 0;color:#4A5568;font-size:14px;">✓ Your personalized financial analysis report will be prepared</td></tr>
        <tr><td style="padding:6px 0;color:#4A5568;font-size:14px;">✓ You will receive your detailed report within <strong>24 hours</strong></td></tr>
      </table>
    `,
    interpretation:
      "If you would like to discuss your financial situation or have any questions, you can schedule a complimentary consultation below.",
    ctaText: "Schedule Your Complimentary Consultation",
    ctaUrl: bookingUrl,
  });
}

function buildUserConfirmationEmailText(firstName: string): string {
  const bookingUrl =
    "https://tidycal.com/kingsley-ekinde/30-minute-meeting-1vr60yy";

  return `Your Financial Diagnostics Submission Has Been Received

Hello ${firstName},

Thank you for completing your comprehensive Financial Stress Diagnostic. We have successfully received your submission and your personalized detailed report is now being prepared.

What happens next:
- Our team will review your diagnostic data
- Your personalized financial analysis report will be prepared
- You will receive your detailed report within 24 hours

If you would like to discuss your financial situation or have any questions, you can schedule a complimentary consultation:
${bookingUrl}

Respectfully,
KB&K Legacy Shield Team

---
All information you provided is encrypted and handled confidentially.`;
}

// ── Main Handler ──

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { intake_id, wizard_data } = await req.json();

    if (!intake_id || !wizard_data) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Verify intake exists and is paid
    const { data: intake, error: intakeErr } = await supabase
      .from("financial_stress_test_intakes")
      .select(
        "id, email, first_name, last_name, phone, marital_status, number_of_children, primary_concern, payment_status",
      )
      .eq("id", intake_id)
      .eq("payment_status", "paid")
      .maybeSingle();

    if (intakeErr || !intake) {
      return new Response(
        JSON.stringify({ success: false, error:
            "Payment verification required before accessing the detailed diagnostic.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2) Check for duplicate submission
    const { data: existing } = await supabase
      .from("detailed_diagnostics")
      .select("id")
      .eq("intake_id", intake_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: "Your detailed diagnostic has already been submitted.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3) Extract and validate numeric fields
    const d: Record<string, number> = {};
    const numericFields = [
      "client_annual_gross_income",
      "spouse_annual_gross_income",
      "monthly_take_home_income",
      "monthly_essential_expenses",
      "monthly_lifestyle_expenses",
      "emergency_fund_balance",
      "other_liquid_savings",
      "total_retirement_savings",
      "total_non_retirement_investments",
      "mortgage_balance",
      "total_consumer_debt",
      "student_loans",
      "credit_card_debt",
      "life_insurance_client",
      "life_insurance_spouse",
      "income_replacement_years",
      "expected_retirement_age",
      "desired_monthly_retirement_income",
      "annual_retirement_contributions",
      "number_of_children",
      "estimated_college_funding_goal",
      "current_college_savings",
    ];

    for (const field of numericFields) {
      d[field] = Math.max(0, Number(wizard_data[field]) || 0);
    }

    const hasDis = !!wizard_data.has_disability_coverage;

    // 4) Score
    const income = scoreIncomeStability(d);
    const protection = scoreProtection(d);
    const liquidity = scoreLiquidity(d);
    const retirement = scoreRetirement(d);
    const totalScore =
      0.25 * income + 0.3 * protection + 0.2 * liquidity + 0.25 * retirement;
    const classification = classify(totalScore);

    const pillarScores = { income, protection, liquidity, retirement };

    // Ratios (per specification: use client_annual_gross_income only, essential expenses only)
    const totalDebt =
      d.mortgage_balance +
      d.total_consumer_debt +
      d.student_loans +
      d.credit_card_debt;
    const essential_expense_ratio =
      d.monthly_take_home_income > 0
        ? d.monthly_essential_expenses / d.monthly_take_home_income
        : 0;
    const liquidity_months =
      d.monthly_essential_expenses > 0
        ? (d.emergency_fund_balance + d.other_liquid_savings) /
          d.monthly_essential_expenses
        : 0;
    const debt_ratio =
      d.client_annual_gross_income > 0
        ? totalDebt / d.client_annual_gross_income
        : 0;
    const required_coverage =
      d.mortgage_balance +
      totalDebt +
      d.client_annual_gross_income * d.income_replacement_years;
    const actual_coverage = d.life_insurance_client + d.life_insurance_spouse;
    const protection_ratio =
      required_coverage > 0 ? actual_coverage / required_coverage : 0;
    const required_retirement_capital =
      d.desired_monthly_retirement_income * 12 * 25;
    const retirement_funding_ratio =
      required_retirement_capital > 0
        ? d.total_retirement_savings / required_retirement_capital
        : 0;

    const ratios = {
      essential_expense_ratio,
      liquidity_months,
      total_debt: totalDebt,
      debt_ratio,
      required_coverage,
      actual_coverage,
      protection_ratio,
      required_retirement_capital,
      retirement_funding_ratio,
    };

    // 4b) Top risk detection
    const riskItems = [
      { label: "Protection Gap", severity: 1 - protection_ratio },
      { label: "Liquidity Shortfall", severity: (6 - liquidity_months) / 6 },
      { label: "Debt Pressure", severity: Math.max(debt_ratio - 1, 0) },
      {
        label: "Retirement Funding Gap",
        severity: 1 - retirement_funding_ratio,
      },
    ].sort((a, b) => b.severity - a.severity);

    const top_risk_1 = riskItems[0]?.label ?? null;
    const top_risk_2 = riskItems[1]?.label ?? null;
    const top_risk_3 = riskItems[2]?.label ?? null;

    console.log(
      `Diagnostic scored for ${intake_id}: ${totalScore.toFixed(1)} (${classification})`,
    );
    console.log(`Top risks: ${top_risk_1}, ${top_risk_2}, ${top_risk_3}`);

    // 5) Save to database
    const { error: insertErr } = await supabase
      .from("detailed_diagnostics")
      .insert({
        intake_id,
        client_first_name: intake.first_name,
        client_last_name: intake.last_name,
        client_email: intake.email,
        client_phone: intake.phone,
        marital_status: intake.marital_status,
        primary_concern: intake.primary_concern,
        ...Object.fromEntries(numericFields.map((f) => [f, d[f]])),
        has_disability_coverage: hasDis,
        income_score: income,
        liquidity_score: liquidity,
        protection_score: protection,
        retirement_score: retirement,
        actual_coverage,
        required_coverage,
        protection_ratio_value: protection_ratio,
        debt_ratio_value: debt_ratio,
        total_debt: totalDebt,
        essential_expense_ratio,
        liquidity_months,
        required_retirement_capital,
        retirement_funding_ratio,
        total_score: Math.round(totalScore * 10) / 10,
        risk_classification: classification,
        status: "submitted",
        report_generated_at: new Date().toISOString(),
        top_risk_1,
        top_risk_2,
        top_risk_3,
      });

    if (insertErr) {
      console.error("Insert error:", insertErr.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save diagnostic." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 6) Send admin notification email

    try {
      const adminRecipients = ["test@kaltechconsultancy.tech"];
      const replyTo = Deno.env.get("EMAIL_REPLY_TO");
      if (replyTo && replyTo !== "test@kaltechconsultancy.tech") {
        adminRecipients.push(replyTo);
      }

      const adminHTML = buildAdminEmailHTML(
        intake.first_name,
        intake.last_name,
        intake.email,
        pillarScores,
        totalScore,
        classification,
        ratios,
      );

      await transporter.sendMail({
        from: Deno.env.get("EMAIL_FROM"),
        to: [adminRecipients],
        subject: `New Detailed Diagnostic — ${intake.first_name} ${intake.last_name}`,
        html: adminHTML,
      });

      console.log("Admin notification email sent");
    } catch (emailErr) {
      console.error("Admin email failed:", emailErr);
      // Don't fail the submission if admin email fails
    }

    // 7) Send user confirmation email (non-blocking)
    try {
      const userHTML = buildUserConfirmationEmailHTML(intake.first_name);
      const userText = buildUserConfirmationEmailText(intake.first_name);

      await transporter.sendMail({
        from: Deno.env.get("EMAIL_FROM"),
        to: [intake.email],
        subject: "Your Financial Diagnostics Submission Has Been Received",
        html: userHTML,
        text: userText,
      });
      console.log(`User confirmation email sent to: ${intake.email}`);
    } catch (userEmailErr) {
      console.error(
        "User confirmation email failed (non-blocking):",
        userEmailErr,
      );
      // Don't fail the submission if user email fails
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
