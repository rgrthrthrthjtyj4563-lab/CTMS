import { useCallback, useEffect, useState } from 'react';
import { loadSession, type AppUser, type Session } from '../lib/session';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await loadSession();
    setSession(s);
    setLoading(false);
    return s;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, user: session?.user as AppUser | undefined, loading, refresh };
}
