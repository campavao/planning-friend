"use client";

import { useEffect, useState } from "react";
import { ActionDrawer } from "@/components/ui/action-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomSection } from "@/lib/supabase";

/**
 * Add or edit one owner-defined row.
 *
 * Free-form label and value rather than a picker of blessed field types: the
 * whole reason this exists is the things no extraction will guess — a
 * confirmation number, who else is coming, where you parked. Constraining that
 * to a fixed vocabulary would defeat it.
 */

interface SectionEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent when adding. */
  section?: CustomSection;
  onSave: (section: CustomSection) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
}

export function SectionEditorDrawer({
  open,
  onOpenChange,
  section,
  onSave,
  onRemove,
}: SectionEditorDrawerProps) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Reseed each time it opens, so an abandoned edit doesn't leak into the next
  // one and "Add" never opens pre-filled with whatever was edited last.
  useEffect(() => {
    if (!open) return;
    setLabel(section?.label ?? "");
    setValue(section?.value ?? "");
    setSaving(false);
  }, [open, section]);

  const canSave = label.trim().length > 0 && value.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ label: label.trim(), value: value.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ActionDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={section ? "Edit section" : "Add section"}
    >
      <div className="px-3.5 pb-3 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="section-label">Label</Label>
          <Input
            id="section-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Seats"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="section-value">Value</Label>
          <Input
            id="section-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="310, 312"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          {onRemove && (
            <Button
              variant="ghost"
              className="ml-auto text-destructive hover:bg-red-50"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onRemove();
                  onOpenChange(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </ActionDrawer>
  );
}
