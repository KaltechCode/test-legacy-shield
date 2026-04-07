import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, ShieldCheck } from "lucide-react";

interface EmailVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  firstName: string;
  onVerified: (leadId: string, email: string, firstName: string, lastName: string) => void;
  onResendCode: () => void;
}

export const EmailVerificationModal = ({ 
  open, 
  onOpenChange, 
  email, 
  firstName,
  onVerified,
  onResendCode
}: EmailVerificationModalProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-email-code", {
        body: {
          email: email,
          code: code.trim(),
        },
      });

      if (error) throw error;

      if (data?.success) {
        // Store verification in session
        sessionStorage.setItem("fin_verified_email", email);
        sessionStorage.setItem("fin_lead_id", data.leadId);
        sessionStorage.setItem("fin_first_name", data.firstName);
        sessionStorage.setItem("fin_last_name", data.lastName);

        toast.success("Email verified successfully!");
        onVerified(data.leadId, data.email, data.firstName, data.lastName);
        onOpenChange(false);
      } else {
        toast.error(data?.error || "Invalid verification code");
      }
    } catch (error: any) {
      console.error("Error verifying code:", error);
      toast.error(error.message || "Failed to verify code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      onResendCode();
      toast.success("New verification code sent!");
      setCode("");
    } catch (error) {
      toast.error("Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-heading text-primary text-center">
            Verify Your Email
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center mt-2">
            We sent a 6-digit code to your email. Enter it below to receive your results.
          </p>
        </DialogHeader>

        <form onSubmit={handleVerify} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="code" className="text-center block">
              <ShieldCheck className="inline w-4 h-4 mr-1" />
              Verification Code
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              disabled={loading}
              className="text-center text-2xl font-mono tracking-widest"
              maxLength={6}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              Code expires in 10 minutes
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </div>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={handleResend}
              disabled={resending || loading}
              className="text-sm"
            >
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Sending...
                </>
              ) : (
                "Didn't receive the code? Resend"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
