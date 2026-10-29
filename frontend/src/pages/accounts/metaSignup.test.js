import { metaSignup } from "./metaSignup";
const session = { sessionId: "local-session", stateToken: "a".repeat(64), appId: "12345", configId: "67890", graphVersion: "v22.0" };
let callback;
const event = (origin = "https://www.facebook.com", name = "FINISH") => window.dispatchEvent(new MessageEvent("message", { origin, data: JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: name, data: { waba_id: "99999", phone_number_id: "11111" } }) }));
beforeEach(() => { window.FB = { init: jest.fn(), login: jest.fn(cb => { callback = cb; }) }; });
afterEach(() => { delete window.FB; });
test("waits for the authorization code and trusted Meta asset event", async () => {
  const controller = new AbortController(); const pending = metaSignup(session, controller.signal); await Promise.resolve();
  event("https://malicious.example"); callback({ authResponse: { code: "real-code" } });
  event(); expect(await pending).toEqual({ sessionId: session.sessionId, stateToken: session.stateToken, code: "real-code", wabaId: "99999", phoneNumberId: "11111" });
});
test("supports Meta events arriving before the code", async () => {
  const pending = metaSignup(session, new AbortController().signal); await Promise.resolve(); event(); callback({ authResponse: { code: "real-code" } }); expect((await pending).code).toBe("real-code");
});
test("cancellation rejects rather than manufacturing a connection", async () => {
  const controller = new AbortController(); const pending = metaSignup(session, controller.signal); await Promise.resolve(); controller.abort(); await expect(pending).rejects.toThrow("cancelled");
});
test("provider cancellation is an error and cleans up the signup listener", async () => {
  const pending = metaSignup(session, new AbortController().signal); await Promise.resolve(); event("https://www.facebook.com", "CANCEL"); await expect(pending).rejects.toThrow("cancelled");
});
