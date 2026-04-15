import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer";

const transporter = nodemailer.createTransport({
  host: Deno.env.get("SMTP_USER") ?? "",
  port: Deno.env.get("SMTP_PORT")
    ? parseInt(Deno.env.get("SMTP_PORT") ?? "465")
    : 465,
  secure: true,
  auth: {
    user: Deno.env.get("SMTP_USER") ?? "",
    pass: Deno.env.get("SMTP_PASS") ?? "",
  },
});

export default transporter;
