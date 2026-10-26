export function requestKey(prefix = "request") {
  const random = window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
