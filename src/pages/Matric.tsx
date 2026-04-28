import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

import { supabase } from "@/integrations/supabase/client";

// ── Progress Indicator ──

// ── Main Wizard Page ──

const Metric = () => {
  usePageTitle("Comprehensive Financial Stress Analysis");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [data, setData] = useState<any>(null);

  const intakeId = sessionStorage.getItem("diagnostic_intake_id");

  console.log(data);

  async function fetchExistingData(intakeId: string) {
    if (!intakeId) return null;

    try {
      const { data: result, error: RetrieveError } =
        await supabase.functions.invoke("retrieve-detailed-result", {
          body: { intake_id: intakeId },
        });

      if (RetrieveError || result?.error) {
        setError(result?.error || "Retrieval failed. Please try again.");
        return null;
      }

      setData(result);
      return result;
    } catch {
      setError("Something went wrong. Please try again.");
      return null;
    }
  }

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        // const {
        //   data: { session },
        // } = await supabase.auth.getSession();

        // if (!session) {
        //   setError("Please log in to access this page");
        //   setLoading(false);
        //   return;
        // }

        if (!intakeId) {
          navigate("/stress-test/diagnostic", { replace: true });
          return;
        }

        await fetchExistingData(intakeId);
      } catch (error) {
        setError("Authentication failed. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [intakeId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-lg border border-border p-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <div className="">dashboard</div>;
};

export default Metric;
