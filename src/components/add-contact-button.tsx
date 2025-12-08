"use client";

import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/lib/utils";

interface AddContactButtonProps {
  variant?: "button" | "link" | "inline";
  className?: string;
}

export function AddContactButton({
  variant = "button",
  className = "",
}: AddContactButtonProps) {
  const phoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "";

  const handleAddContact = () => {
    // Create vCard content
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Planning Friend
TEL;TYPE=CELL:${phoneNumber}
NOTE:Your planning friend! Text links to save meals, events, and ideas.
END:VCARD`;

    // Create blob and download
    const blob = new Blob([vCard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "Planning-Friend.vcf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (variant === "link") {
    return (
      <button
        onClick={handleAddContact}
        className={`text-primary font-medium hover:underline ${className}`}
      >
        {formatPhoneNumber(phoneNumber)}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="text-primary font-medium">
          {formatPhoneNumber(phoneNumber)}
        </span>
        <button
          onClick={handleAddContact}
          className="text-xs text-muted-foreground hover:text-primary underline"
        >
          (add to contacts)
        </button>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleAddContact}
      className={`hover:bg-washi-mint/20 ${className}`}
    >
      📱 Add to Contacts
    </Button>
  );
}

export function PhoneNumberDisplay() {
  const phoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "";
  return <span>{formatPhoneNumber(phoneNumber)}</span>;
}
