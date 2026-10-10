import { mergeLocalMessages, localMediaUrl } from "./waLocalCache";
test("local chat bodies and menu IDs survive metadata-only server responses", () => {
  const messages = mergeLocalMessages([{ id: "one", body: "Private chat", timestamp: 1, interactive: { buttons: [{ id: "rice" }] } }], [{ id: "one", body: "", timestamp: 1, status: "read" }]);
  expect(messages).toHaveLength(1);
  expect(messages[0].body).toBe("Private chat");
  expect(messages[0].interactive.buttons[0].id).toBe("rice");
  expect(messages[0].status).toBe("read");
});
test("local cache merges new messages and retains older history", () => {
  expect(mergeLocalMessages([{ id: "old", timestamp: 1 }], [{ id: "new", timestamp: 2 }]).map((message) => message.id)).toEqual(["new", "old"]);
});
test("downloaded attachments become browser blob URLs for document previews", () => {
  URL.createObjectURL = jest.fn(() => "blob:local-file");
  expect(localMediaUrl({ data: btoa("PDF data"), mimetype: "application/pdf" })).toBe("blob:local-file");
  expect(URL.createObjectURL.mock.calls[0][0].type).toBe("application/pdf");
});
