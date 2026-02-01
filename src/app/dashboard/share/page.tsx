"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";

function ShareStatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive status from URL params (no need for state)
  const { status, message } = useMemo(() => {
    const result = searchParams.get("result");
    const error = searchParams.get("error");

    if (result === "success") {
      return {
        status: "success" as const,
        message: "Content saved! Redirecting to dashboard...",
      };
    } else if (error) {
      return {
        status: "error" as const,
        message: decodeURIComponent(error),
      };
    }
    return {
      status: "processing" as const,
      message: "Processing shared content...",
    };
  }, [searchParams]);

  useEffect(() => {
    // Handle redirects based on status
    if (status === "success") {
      const timer = setTimeout(() => router.push("/dashboard"), 1500);
      return () => clearTimeout(timer);
    } else if (status === "processing") {
      // If we got here via GET without params, redirect to dashboard
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="card-elevated p-8 max-w-md w-full text-center">
      {status === "processing" && (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
            <div className="loading-spinner" />
          </div>
          <h1 className="heading-2 mb-2">Processing...</h1>
          <p className="text-muted-foreground text-sm">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-50 flex items-center justify-center">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="heading-2 mb-2">Saved!</h1>
          <p className="text-muted-foreground text-sm">{message}</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <span className="text-3xl">!</span>
          </div>
          <h1 className="heading-2 mb-2">Oops!</h1>
          <p className="text-muted-foreground text-sm mb-4">{message}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="card-elevated p-8 max-w-md w-full text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
      <h1 className="heading-2 mb-2">Loading...</h1>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <Suspense fallback={<LoadingFallback />}>
        <ShareStatusContent />
      </Suspense>
    </main>
  );
}

