import { useCallback, useEffect, useRef, useState } from 'react';
import { portalError } from '../utils/clientPortalApi';
export default function useClientPortalRefresh(load, enabled = true) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [refreshing, setRefreshing] = useState(false);
  const active = useRef(null), epoch = useRef(0);
  const refresh = useCallback(async () => {
    if (!enabled || active.current) return;
    const controller = new AbortController(), version = epoch.current;
    active.current = controller; setRefreshing(true);
    try { const result = await load(controller.signal); if (!controller.signal.aborted && epoch.current === version) { setData(result); setError(''); } }
    catch (failure) { if (!controller.signal.aborted && epoch.current === version) setError(portalError(failure)); }
    finally { if (active.current === controller) { active.current = null; setRefreshing(false); } }
  }, [load, enabled]);
  useEffect(() => {
    epoch.current++; setData(null); setError(''); refresh();
    const visible = () => { if (!document.hidden) refresh(); };
    const interval = setInterval(visible, 30000);
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { epoch.current++; active.current?.abort(); active.current = null; clearInterval(interval); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return { data, error, refreshing, refresh, setData };
}
