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

  console.log(intakeId);

  async function fetchExistingData(intakeId: string) {
    if (!intakeId) return null;

    try {
      const { data: result, error: RetrieveError } =
        await supabase.functions.invoke("retrieve-detailed-result", {
          body: { intake_id: intakeId },
        });

      console.log("Data", data);
      setData(result);
      if (RetrieveError || result?.error) {
        setError(result?.error || "Retrieval failed. Please try again.");
        return;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  useEffect(() => {
    if (!data) {
      navigate("/stress-test/diagnostic", { replace: true });
      return;
    }

    fetchExistingData(intakeId);

    setLoading(false);
  }, [intakeId, navigate]);

  return <div className="">dashboard</div>;
};

export default Metric;
