"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface AddToHomeScreenButtonProps {
  variant?: "button" | "link";
  className?: string;
}

export function AddToHomeScreenButton({
  variant = "button",
  className = "",
}: AddToHomeScreenButtonProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already running as standalone app
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    setIsStandalone(standalone);
  }, []);

  // Don't show if already installed as app
  if (isStandalone) {
    return null;
  }

  const handleClick = () => {
    setShowInstructions(true);
  };

  const buttonContent = (
    <>
      {variant === "button" ? "📲 Add to Home Screen" : "Add to Home Screen"}
    </>
  );

  return (
    <>
      {variant === "link" ? (
        <button
          onClick={handleClick}
          className={`text-primary font-medium hover:underline ${className}`}
        >
          {buttonContent}
        </button>
      ) : (
        <Button
          variant="outline"
          onClick={handleClick}
          className={`hover:bg-washi-pink/20 ${className}`}
        >
          {buttonContent}
        </Button>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <span className="text-4xl">📲</span>
              <h3 className="font-semibold text-lg mt-2">Add to Home Screen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Get quick access like a real app!
              </p>
            </div>

            {isIOS ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="text-2xl">1️⃣</span>
                  <div>
                    <p className="font-medium text-sm">Tap the Share button</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Look for{" "}
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-muted rounded">
                        <ShareIcon />
                      </span>{" "}
                      at the bottom of Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="text-2xl">2️⃣</span>
                  <div>
                    <p className="font-medium text-sm">
                      Scroll down and tap &quot;Add to Home Screen&quot;
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      It has a{" "}
                      <span className="inline-flex items-center justify-center w-5 h-5 bg-muted rounded">
                        <PlusSquareIcon />
                      </span>{" "}
                      icon next to it
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="text-2xl">3️⃣</span>
                  <div>
                    <p className="font-medium text-sm">Tap &quot;Add&quot;</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      That&apos;s it! The app will appear on your home screen
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="text-2xl">💡</span>
                  <div>
                    <p className="font-medium text-sm">
                      On iPhone Safari
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tap Share → Add to Home Screen
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="text-2xl">🤖</span>
                  <div>
                    <p className="font-medium text-sm">On Android Chrome</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Tap Menu (⋮) → Add to Home Screen
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="text-2xl">🖥️</span>
                  <div>
                    <p className="font-medium text-sm">On Desktop Chrome</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click the install icon in the address bar, or Menu →
                      Install App
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full mt-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// iOS Share icon
function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

// Plus square icon
function PlusSquareIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

