import html2canvas from "html2canvas";
import { groceryLine, type AisleGroup } from "@/lib/grocery-list";

/**
 * Render the list as a PNG for the store's "add list from photo" feature.
 *
 * Built for OCR rather than looks: black on white, one item per line, no
 * bullets or icons the reader would mistake for characters, and aisle names
 * set apart in capitals so they read as headings.
 */
export async function renderGroceryImage(
  groups: AisleGroup[],
  subtitle: string,
  filename: string,
): Promise<File> {
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    background: white;
    padding: 32px;
    font-family: Arial, sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: black;
    width: 480px;
  `;

  const heading = document.createElement("div");
  heading.style.cssText =
    "font-weight: bold; font-size: 24px; border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 8px;";
  heading.textContent = subtitle ? `Grocery List (${subtitle})` : "Grocery List";
  container.appendChild(heading);

  for (const group of groups) {
    const aisle = document.createElement("div");
    aisle.style.cssText =
      "font-weight: bold; font-size: 16px; letter-spacing: 1px; margin-top: 16px; margin-bottom: 4px;";
    aisle.textContent = group.aisle.toUpperCase();
    container.appendChild(aisle);

    for (const item of group.items) {
      const line = document.createElement("div");
      line.textContent = groceryLine(item);
      container.appendChild(line);
    }
  }

  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Could not render the list as an image");
    return new File([blob], filename, { type: "image/png" });
  } finally {
    container.remove();
  }
}

export function canShareImageFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob()], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * An installed home-screen app (manifest display: standalone). iOS gives a
 * standalone PWA no download UI at all: a programmatic <a download> there
 * resolves silently and saves nothing. Sharing is the only way out there.
 */
export function isStandaloneApp(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

/** Resolves false when the person dismissed the sheet. */
export async function shareImage(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title: "Grocery list" });
    return true;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return false;
    throw error;
  }
}

export function downloadImage(file: File) {
  // An object URL rather than a data URL: a several-megabyte data: href is
  // refused outright by some browsers.
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.download = file.name;
  link.href = url;
  // Appended because a detached anchor is a no-op in Firefox.
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked late: revoking in the same tick cancels the download in some
  // browsers before it has started reading.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
