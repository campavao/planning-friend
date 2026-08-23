/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { AttributeChips } from "@/app/dashboard/[id]/components/AttributeChips";
import type { MealData } from "@/lib/db/types";
import { fireEvent, render, screen } from "@testing-library/react";

const PLANTS: MealData["plants"] = [
  { source: "garlic", category: "vegetable" },
  { source: "scallion", category: "vegetable" },
  { source: "soybean", name: "soy sauce", category: "legume" },
  { source: "wheat", name: "egg noodles", category: "whole_grain" },
  { source: "sesame", category: "seed" },
];

describe("AttributeChips", () => {
  it("renders effort, spice and plant count", () => {
    render(
      <AttributeChips category="meal" data={{ effort: "easy", spice: "mild", plants: PLANTS }} />
    );
    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("Mild")).toBeInTheDocument();
    expect(screen.getByText("5 plants")).toBeInTheDocument();
  });

  it("renders nothing at all when the item predates these fields", () => {
    // The whole point: an un-backfilled recipe shows no chips rather than
    // three chips saying "Unknown".
    const { container } = render(
      <AttributeChips category="meal" data={{ ingredients: ["1 cup rice"] }} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the attributes that are present", () => {
    render(<AttributeChips category="meal" data={{ spice: "hot" }} />);
    expect(screen.getByText("Hot")).toBeInTheDocument();
    expect(screen.queryByText(/plant/)).not.toBeInTheDocument();
  });

  it("counts plants by source, not by ingredient", () => {
    // Two ingredients, one shared source — one plant.
    render(
      <AttributeChips
        category="meal"
        data={{
          plants: [
            { source: "wheat", name: "egg noodles", category: "whole_grain" },
            { source: "wheat", name: "soy sauce", category: "whole_grain" },
          ],
        }}
      />
    );
    expect(screen.getByText("1 plant")).toBeInTheDocument();
  });

  it("singularises a single plant", () => {
    render(
      <AttributeChips
        category="meal"
        data={{ plants: [{ source: "garlic", category: "vegetable" }] }}
      />
    );
    expect(screen.getByText("1 plant")).toBeInTheDocument();
  });

  it("makes the plant chip tappable only when given a handler", () => {
    const onShowPlants = jest.fn();
    const { rerender } = render(
      <AttributeChips category="meal" data={{ plants: PLANTS }} onShowPlants={onShowPlants} />
    );
    fireEvent.click(screen.getByText("5 plants"));
    expect(onShowPlants).toHaveBeenCalledTimes(1);

    rerender(<AttributeChips category="meal" data={{ plants: PLANTS }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ignores a plant list that survived from an older shape", () => {
    // An extraction that emitted bare strings must not produce a count.
    const { container } = render(
      <AttributeChips
        category="meal"
        data={{ plants: ["garlic", "onion"] as unknown as MealData["plants"] }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not count herb_spice entries", () => {
    render(
      <AttributeChips
        category="meal"
        data={{
          plants: [
            { source: "garlic", category: "vegetable" },
            // Category no longer exists; readPlants drops it.
            {
              source: "basil",
              category: "herb_spice",
            } as unknown as NonNullable<MealData["plants"]>[number],
          ],
        }}
      />
    );
    expect(screen.getByText("1 plant")).toBeInTheDocument();
  });
});
