import { getInteractiveMessage, safeActionUrl } from "./waInteractiveMessage";

test("restores sectioned Flowbot menus from saved history without the numbered body", () => {
  const menu = getInteractiveMessage({ body: "Old numbered fallback", interactive_payload: JSON.stringify({ type: "interactive_menu", text: "Choose a category", sections: [{ title: "Food", buttons: [{ id: "grains", label: "Rice", description: "Wholesale bags" }] }] }) });
  expect(menu.body).toBe("Choose a category");
  expect(menu.groups[0].title).toBe("Food");
  expect(menu.options[0]).toMatchObject({ id: "grains", title: "Rice", description: "Wholesale bags" });
});

test("Meta reply buttons retain IDs even when two labels are identical", () => {
  const menu = getInteractiveMessage({ interactive: { type: "button", body: { text: "Choose a pack" }, action: { buttons: [{ type: "reply", reply: { id: "small", title: "Order" } }, { type: "reply", reply: { id: "large", title: "Order" } }] } } });
  expect(menu.options.map((option) => option.id)).toEqual(["small", "large"]);
  expect(menu.body).toBe("Choose a pack");
});

test("ordinary numbered text remains text, while explicit legacy menus use option numbers", () => {
  expect(getInteractiveMessage({ body: "Instructions\n1. Pay your invoice\n2. Keep the receipt" })).toBeNull();
  const menu = getInteractiveMessage({ body: "Choose an option:\n\n*1.* Rice\n*2.* Oils\n_Reply with the option number (1, 2, 3...) or the option name._" });
  expect(menu.options.map((option) => option.id)).toEqual(["1", "2"]);
  expect(menu.body).toBe("Choose an option:");
});

test("broken metadata is harmless and unsafe action URLs are rejected", () => {
  expect(getInteractiveMessage({ body: "Hi", interactive_payload: "broken" })).toBeNull();
  expect(safeActionUrl("javascript:alert(1)")).toBeNull();
  expect(safeActionUrl("https://example.com/order")).toBe("https://example.com/order");
  expect(safeActionUrl("+91 98765 43210", "call")).toBe("tel:+919876543210");
});
