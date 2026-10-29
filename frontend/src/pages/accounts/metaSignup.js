let sdk;
function loadSdk() {
  if (window.FB) return Promise.resolve(window.FB);
  if (!sdk) sdk = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    const timeout = setTimeout(() => { script.remove(); sdk = null; reject(new Error("Meta signup took too long to load. Try again.")); }, 20000);
    script.onload = () => { clearTimeout(timeout); if (window.FB) resolve(window.FB); else { sdk = null; reject(new Error("Meta signup is unavailable.")); } };
    script.onerror = () => { clearTimeout(timeout); sdk = null; reject(new Error("Could not load Meta signup. Check your browser connection.")); };
    document.head.appendChild(script);
  });
  return sdk;
}
export async function metaSignup(session, signal) {
  const fb = await loadSdk();
  if (signal.aborted) throw new Error("Signup cancelled.");
  fb.init({ appId: session.appId, version: session.graphVersion, cookie: false, xfbml: false });
  return new Promise((resolve, reject) => {
    let code, assets, settled = false;
    const finish = (error) => {
      if (settled || (!error && (!code || !assets))) return;
      settled = true; clearTimeout(timer); window.removeEventListener("message", receive); signal.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve({ sessionId: session.sessionId, stateToken: session.stateToken, code, ...assets });
    };
    const cancel = () => finish(new Error("Signup cancelled."));
    const receive = event => {
      if (!["https://www.facebook.com", "https://web.facebook.com"].includes(event.origin)) return;
      let data; try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch (_) { return; }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event === "FINISH" && data.data?.waba_id && data.data?.phone_number_id) { assets = { wabaId: String(data.data.waba_id), phoneNumberId: String(data.data.phone_number_id) }; finish(); }
      if (["CANCEL", "ERROR"].includes(data.event)) finish(new Error("Meta signup was cancelled or could not finish. Start again."));
    };
    const timer = setTimeout(() => finish(new Error("Signup expired. Start a new session.")), 14 * 60000);
    signal.addEventListener("abort", cancel, { once: true }); window.addEventListener("message", receive);
    try { fb.login(response => { code = response?.authResponse?.code; if (!code) finish(new Error("Meta did not authorize this connection.")); else finish(); }, { config_id: session.configId, response_type: "code", override_default_response_type: true, extras: { sessionInfoVersion: "3" } }); }
    catch (_) { finish(new Error("Could not open Meta signup. Allow the Meta window and retry.")); }
  });
}
