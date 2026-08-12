/**
 * @jest-environment jsdom
 */
import { ContentDataEditor } from "@/app/dashboard/[id]/components/ContentDataEditor";
import { diffContentData } from "@/lib/schemas/content";
import type { ContentCategory } from "@/lib/supabase";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

/**
 * The client half of the round trip: the editor is handed the stored blob and
 * has to give back an object that still contains everything it was given. What
 * the page then sends is the difference between the two, so these tests assert
 * on that difference rather than on the form's internals.
 */
function Harness({
  category,
  stored,
}: {
  category: ContentCategory;
  stored: Record<string, unknown>;
}) {
  const [data, setData] = useState(stored);

  return (
    <>
      <ContentDataEditor
        category={category}
        data={data}
        onChange={setData}
      />
      <output data-testid="patch">
        {JSON.stringify(diffContentData(stored, data))}
      </output>
    </>
  );
}

function currentPatch(): Record<string, unknown> {
  return JSON.parse(screen.getByTestId("patch").textContent ?? "{}");
}

const STORED_MEAL = {
  ingredients: ["2 cups flour", "1 tsp salt"],
  recipe: ["Mix", "Bake"],
  prep_time: "15 min",
  cook_time: "40 min",
  servings: "4",
  source_notes: "left behind by an older extraction",
};

describe("ContentDataEditor — meal", () => {
  it("fills the form from the stored blob", () => {
    render(<Harness category="meal" stored={STORED_MEAL} />);

    expect((screen.getByLabelText("Prep time") as HTMLInputElement).value).toBe(
      "15 min"
    );
    expect(
      (screen.getByLabelText("ingredient 1") as HTMLInputElement).value
    ).toBe("2 cups flour");
    expect((screen.getByLabelText("step 2") as HTMLInputElement).value).toBe(
      "Bake"
    );
  });

  it("sends nothing before anything is touched", () => {
    render(<Harness category="meal" stored={STORED_MEAL} />);

    expect(currentPatch()).toEqual({});
  });

  it("sends only the field that changed", () => {
    render(<Harness category="meal" stored={STORED_MEAL} />);

    fireEvent.change(screen.getByLabelText("Servings"), {
      target: { value: "6" },
    });

    expect(currentPatch()).toEqual({ servings: "6" });
  });

  it("sends the whole list when a line is reordered", () => {
    render(<Harness category="meal" stored={STORED_MEAL} />);

    fireEvent.click(screen.getByLabelText("Move ingredient 2 up"));

    expect(currentPatch()).toEqual({
      ingredients: ["1 tsp salt", "2 cups flour"],
    });
  });

  it("sends a blanked field as an empty string", () => {
    render(<Harness category="meal" stored={STORED_MEAL} />);

    fireEvent.change(screen.getByLabelText("Cook time"), {
      target: { value: "" },
    });

    expect(currentPatch()).toEqual({ cook_time: "" });
  });

  it("never mentions a key it has no field for", () => {
    render(<Harness category="meal" stored={STORED_MEAL} />);

    fireEvent.change(screen.getByLabelText("Prep time"), {
      target: { value: "20 min" },
    });

    // source_notes is not something this form can show — and so not something
    // this form can lose.
    expect(currentPatch()).toEqual({ prep_time: "20 min" });
  });
});

describe("ContentDataEditor — other categories", () => {
  it("offers the gift fields and no recipe list", () => {
    render(
      <Harness
        category="gift_idea"
        stored={{ name: "Cast iron pan", cost: "$45" }}
      />
    );

    expect((screen.getByLabelText("Cost") as HTMLInputElement).value).toBe(
      "$45"
    );
    expect(screen.queryByLabelText("ingredient 1")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add ingredient" })
    ).toBeNull();
  });

  it("toggles an event flag without touching the other one", () => {
    render(
      <Harness
        category="event"
        stored={{ location: "The Metro", requires_ticket: true }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ticket required" }));

    expect(currentPatch()).toEqual({ requires_ticket: false });
  });

  it("keeps a recipe's lines visible after it is re-filed as a drink", () => {
    // Category switching does not throw the extracted data away, so the
    // ingredients a user already fixed are still there under the new shape.
    render(<Harness category="drink" stored={STORED_MEAL} />);

    expect(
      (screen.getByLabelText("ingredient 1") as HTMLInputElement).value
    ).toBe("2 cups flour");
  });
});
