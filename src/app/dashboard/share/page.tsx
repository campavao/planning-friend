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
    <div className="scrapbook-card p-8 max-w-md w-full text-center">
      {status === "processing" && (
        <>
          <div className="text-5xl mb-4 animate-wiggle">✂️</div>
          <h1 className="text-xl font-handwritten mb-2">Clipping...</h1>
          <p className="text-muted-foreground">{message}</p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-handwritten mb-2">Saved!</h1>
          <p className="text-muted-foreground">{message}</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-handwritten mb-2">Oops!</h1>
          <p className="text-muted-foreground mb-4">{message}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
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
    <div className="scrapbook-card p-8 max-w-md w-full text-center">
      <div className="text-5xl mb-4 animate-wiggle">✂️</div>
      <h1 className="text-xl font-handwritten mb-2">Loading...</h1>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-paper p-4">
      <Suspense fallback={<LoadingFallback />}>
        <ShareStatusContent />
      </Suspense>
    </main>
  );
}

