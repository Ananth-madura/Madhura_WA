import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import WAInteractiveOptions from "./WAInteractiveOptions";
import { getInteractiveMessage } from "../utils/waInteractiveMessage";

test("clicking a labelled option sends its stable ID", () => {
  const reply = jest.fn();
  render(<WAInteractiveOptions menu={getInteractiveMessage({ buttons: [{ id: "product_2", title: "Order now" }] })} onReply={reply} />);
  fireEvent.click(screen.getByRole("button", { name: "Order now" }));
  expect(reply).toHaveBeenCalledWith("product_2", "Order now");
});

test("list expands into grouped options with descriptions", () => {
  const reply = jest.fn();
  render(<WAInteractiveOptions menu={getInteractiveMessage({ interactive: { type: "list", text: "Menu", sections: [{ title: "Grains", rows: [{ id: "rice", title: "Rice", description: "25 kg bag" }] }] } })} onReply={reply} />);
  const toggle = screen.getByRole("button", { name: /View options/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByText("Grains")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Rice 25 kg bag/ }));
  expect(reply).toHaveBeenCalledWith("rice", "Rice");
});

test("sent menus are inspectable but cannot impersonate a customer's reply", () => {
  const reply = jest.fn();
  render(<WAInteractiveOptions menu={getInteractiveMessage({ buttons: [{ id: "confirm", title: "Confirm" }] })} readOnly onReply={reply} />);
  const choice = screen.getByRole("button", { name: "Confirm" });
  expect(choice.disabled).toBe(true);
  fireEvent.click(choice);
  expect(reply).not.toHaveBeenCalled();
});
