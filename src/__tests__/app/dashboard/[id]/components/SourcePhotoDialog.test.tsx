/**
 * @jest-environment jsdom
 */
import { SourcePhotoDialog } from "@/app/dashboard/[id]/components/SourcePhotoDialog";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const PHOTO_URL =
  "https://project.supabase.co/storage/v1/object/public/thumbnails/abc.jpg";

function renderDialog() {
  return render(
    <SourcePhotoDialog imageUrl={PHOTO_URL} itemTitle="Banana bread" />
  );
}

describe("SourcePhotoDialog", () => {
  it("shows the CTA without mounting the photo until it is asked for", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: "View original photo" })
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the stored file itself rather than a resized copy", async () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "View original photo" }));

    const photo = await screen.findByRole("img", {
      name: "Original photo for Banana bread",
    });
    // `unoptimized` should keep the src pointing straight at the upload; going
    // through the Next image optimizer would hand back a downscaled version.
    expect(photo.getAttribute("src")).toBe(PHOTO_URL);
  });

  it("closes on Escape and hands focus back to the trigger", async () => {
    renderDialog();
    const trigger = screen.getByRole("button", {
      name: "View original photo",
    });

    fireEvent.click(trigger);
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
