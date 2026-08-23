import type { ContentCategory } from "@/lib/db/types";
import { countPlants, readPlants } from "@/lib/plants";

/**
 * The at-a-glance attributes of any saved item (PLA-59).
 *
 * PLA-55 gave recipes chips — effort, spice, plant count — and left every other
 * category with nothing. That is fine while tags are still the filter
 * dimension, and becomes a hole the moment tags are retired: an event, gift or
 * trip would have no filter dimension at all.
 *
 * **Nothing new is extracted here.** Every value below is already in `data`,
 * already validated, and already being written by the extraction prompt — a
 * date idea has carried `type` and `price_range` all along, a drink its
 * difficulty, an event its ticket and reservation flags. They were simply never
 * surfaced as attributes. So this is a rendering change with no migration, no
 * re-processing, and no cost to the 233 items already saved.
 *
 * `key` is the part that matters for what comes next: it is the filter
 * dimension, so it is deliberately shared across categories where the concept
 * is shared. A gift's `cost` and a restaurant's `price_range` both key as
 * `price`, because "show me the cheap ones" is one question and should not
 * become two.
 */

export type AttributeKey =
  | "effort"
  | "spice"
  | "plants"
  | "type"
  | "price"
  | "prep"
  | "ticket"
  | "reservation"
  | "destination";

export interface ItemAttribute {
  key: AttributeKey;
  /** What the chip reads. Already humanised — the UI does no formatting. */
  label: string;
}

const EFFORT_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Some effort",
  hard: "Involved",
};

const SPICE_LABELS: Record<string, string> = {
  none: "Not spicy",
  mild: "Mild",
  medium: "Medium",
  hot: "Hot",
};

/** Title-cases an extracted enum value: "date_idea" is never shown, "dinner" is. */
function humanise(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function push(
  out: ItemAttribute[],
  key: AttributeKey,
  label: string | undefined | null
): void {
  // Absent fields render as nothing rather than "Unknown", which on an item
  // extracted before a field existed would be three lies in a row.
  if (label) out.push({ key, label });
}

type AnyData = Record<string, unknown>;

function str(data: AnyData, field: string): string | undefined {
  const value = data[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function describeAttributes(
  category: ContentCategory | string,
  data: AnyData | null | undefined
): ItemAttribute[] {
  const d = data ?? {};
  const out: ItemAttribute[] = [];

  switch (category) {
    case "meal": {
      const effort = str(d, "effort");
      const spice = str(d, "spice");
      push(out, "effort", effort ? EFFORT_LABELS[effort] : undefined);
      push(out, "spice", spice ? SPICE_LABELS[spice] : undefined);
      const plants = countPlants(readPlants(d.plants));
      push(
        out,
        "plants",
        plants > 0 ? `${plants} ${plants === 1 ? "plant" : "plants"}` : undefined
      );
      break;
    }

    case "drink": {
      const type = str(d, "type");
      const difficulty = str(d, "difficulty");
      push(out, "type", type ? humanise(type) : undefined);
      // A drink's `difficulty` is the same scale as a recipe's `effort` —
      // deliberately the same three values — so it keys the same way.
      push(out, "effort", difficulty ? EFFORT_LABELS[difficulty] : undefined);
      push(out, "prep", str(d, "prep_time"));
      break;
    }

    case "event": {
      push(out, "ticket", d.requires_ticket ? "Ticket required" : undefined);
      push(
        out,
        "reservation",
        d.requires_reservation ? "Reservation" : undefined
      );
      break;
    }

    case "date_idea": {
      const type = str(d, "type");
      push(out, "type", type ? humanise(type) : undefined);
      push(out, "price", str(d, "price_range"));
      break;
    }

    case "travel": {
      const type = str(d, "type");
      push(out, "type", type ? humanise(type) : undefined);
      push(out, "price", str(d, "price_range"));
      // City alone is ambiguous — there is a Paris in Texas — so the country
      // rides along whenever both are known.
      const city = str(d, "destination_city");
      const country = str(d, "destination_country");
      push(out, "destination", [city, country].filter(Boolean).join(", "));
      break;
    }

    case "gift_idea": {
      // Keys as `price`, not `cost`: "show me the cheap ones" is one question
      // whether it is asked of a gift or a restaurant.
      push(out, "price", str(d, "cost"));
      break;
    }

    default:
      break;
  }

  return out;
}
