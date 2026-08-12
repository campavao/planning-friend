/**
 * @jest-environment jsdom
 */
import { EditableLines } from "@/app/dashboard/[id]/components/EditableLines";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

/**
 * The list editor is a controlled component, so what it is worth testing is the
 * array it hands back: add, edit, remove and reorder are the four operations
 * the ticket asks for, and each one has to leave the other lines untouched.
 */
function Harness({ initial }: { initial: string[] }) {
  const [values, setValues] = useState(initial);

  return (
    <>
      <EditableLines
        label="Ingredients"
        itemLabel="ingredient"
        values={values}
        onChange={setValues}
      />
      <output data-testid="values">{JSON.stringify(values)}</output>
    </>
  );
}

function currentValues(): string[] {
  return JSON.parse(screen.getByTestId("values").textContent ?? "[]");
}

const INGREDIENTS = ["2 cups flour", "1 tsp salt", "3 eggs"];

describe("EditableLines", () => {
  it("shows one editable row per line", () => {
    render(<Harness initial={INGREDIENTS} />);

    expect(
      (screen.getByLabelText("ingredient 1") as HTMLInputElement).value
    ).toBe("2 cups flour");
    expect(
      (screen.getByLabelText("ingredient 3") as HTMLInputElement).value
    ).toBe("3 eggs");
  });

  it("edits one line without disturbing its neighbours", () => {
    render(<Harness initial={INGREDIENTS} />);

    fireEvent.change(screen.getByLabelText("ingredient 2"), {
      target: { value: "1 tsp fine salt" },
    });

    expect(currentValues()).toEqual([
      "2 cups flour",
      "1 tsp fine salt",
      "3 eggs",
    ]);
  });

  it("adds an empty row at the end for the next line", () => {
    render(<Harness initial={INGREDIENTS} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));

    expect(currentValues()).toEqual([...INGREDIENTS, ""]);

    fireEvent.change(screen.getByLabelText("ingredient 4"), {
      target: { value: "1 cup milk" },
    });
    expect(currentValues()).toEqual([...INGREDIENTS, "1 cup milk"]);
  });

  it("removes the row it was asked to remove", () => {
    render(<Harness initial={INGREDIENTS} />);

    fireEvent.click(screen.getByLabelText("Remove ingredient 2"));

    expect(currentValues()).toEqual(["2 cups flour", "3 eggs"]);
  });

  it("moves a line up", () => {
    render(<Harness initial={INGREDIENTS} />);

    fireEvent.click(screen.getByLabelText("Move ingredient 3 up"));

    expect(currentValues()).toEqual(["2 cups flour", "3 eggs", "1 tsp salt"]);
  });

  it("moves a line down", () => {
    render(<Harness initial={INGREDIENTS} />);

    fireEvent.click(screen.getByLabelText("Move ingredient 1 down"));

    expect(currentValues()).toEqual(["1 tsp salt", "2 cups flour", "3 eggs"]);
  });

  it("cannot move the ends off the list", () => {
    render(<Harness initial={INGREDIENTS} />);

    expect(
      (screen.getByLabelText("Move ingredient 1 up") as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByLabelText("Move ingredient 3 down") as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("still offers a way in when the list is empty", () => {
    render(<Harness initial={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Add ingredient" }));

    expect(currentValues()).toEqual([""]);
  });

  it("numbers the rows when the list is an ordered one", () => {
    render(
      <EditableLines
        label="Instructions"
        itemLabel="step"
        values={["Mix", "Bake"]}
        onChange={() => {}}
        ordered
      />
    );

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });
});
