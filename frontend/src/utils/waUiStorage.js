import { localCacheOwner } from './waLocalCache';
const scoped = (key) => String(key).startsWith('wa_') ? `wa_user_${localCacheOwner()}:${key}` : key;
export const waUiStorage = {
  getItem: (key) => localStorage.getItem(scoped(key)),
  setItem: (key, value) => localStorage.setItem(scoped(key), value),
  removeItem: (key) => localStorage.removeItem(scoped(key)),
  key: (index) => {
    const prefix = `wa_user_${localCacheOwner()}:`;
    return Object.keys(localStorage).filter((key) => key.startsWith(prefix))[index]?.slice(prefix.length) || null;
  },
  get length() { return Object.keys(localStorage).filter((key) => key.startsWith(`wa_user_${localCacheOwner()}:`)).length; }
};
