# Meta WhatsApp Embedded Signup v4 Specification

## Overview

Meta Embedded Signup v4 provides an embedded customer onboarding experience that enables businesses to create or select a Meta Business Portfolio, provision a WhatsApp Business Account (WABA), and verify phone ownership within a single popup dialog.

---

## 1. Client-Side SDK Integration

### Script Injection
```html
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
```

### SDK Initialization
```javascript
window.fbAsyncInit = function() {
  FB.init({
    appId: "780961714856006",
    autoLogAppEvents: true,
    xfbml: true,
    version: "v21.0"
  });
};
```

---

## 2. Popup Launch Parameters

When the customer clicks "Continue with Facebook / Meta" inside `WhatsAppConnectOnboarding.jsx`, the client invokes `FB.login`:

```javascript
FB.login(
  function(response) {
    if (response.authResponse?.code) {
      // Dispatch authorization code to backend for server-side exchange
      exchangeCode(response.authResponse.code);
    } else {
      handleCancellation(response);
    }
  },
  {
    config_id: "1189434863378370",
    response_type: "code",
    override_default_response_type: true,
    extras: {
      setup: {},
      featureType: "",
      sessionInfoVersion: "3"
    }
  }
);
```

---

## 3. Post-Message Listener (sessionInfoVersion 3)

In addition to `FB.login` callbacks, Embedded Signup v4 dispatches HTML5 `window.postMessage` events for granular step monitoring:

```javascript
window.addEventListener("message", (event) => {
  if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") return;
  try {
    const data = JSON.parse(event.data);
    if (data.type === "WA_EMBEDDED_SIGNUP") {
      switch (data.event) {
        case "FINISH":
          console.log("Embedded signup completed", data.data);
          break;
        case "CANCEL":
          console.log("Customer closed the signup popup");
          break;
        case "ERROR":
          console.error("Meta embedded signup error", data.data);
          break;
      }
    }
  } catch (_) {}
});
```
