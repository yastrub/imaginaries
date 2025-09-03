import type { AuthBindings, CheckResponse } from "@refinedev/core";

export const authProvider: AuthBindings = {
  login: async () => {
    // Admin relies on existing cookie from main app login.
    return { success: true, redirectTo: "/" };
  },
  logout: async () => {
    await fetch(`${API_BASE}/api/auth/signout`, { method: 'POST', credentials: 'include' });
    return { success: true, redirectTo: "/" };
  },
  onError: async (_error) => {
    // No redirect on error; leave current view
    return { error: _error };
  },
  check: async (): Promise<CheckResponse> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
      if (!res.ok) return { authenticated: false, redirectTo: '/login' };
      const data = await res.json();
      const roleId: number | undefined = data?.user?.role_id ?? data?.user?.roleId;
      // Primary: system rule role_id === 1
      // Fallback (temporary): allow if roles/name indicates 'admin' for backward compatibility
      const hasAdminName = Array.isArray(data?.user?.roles)
        ? data.user.roles.includes('admin')
        : false;
      const isSuperuser = roleId === 1 || hasAdminName;
      return isSuperuser
        ? { authenticated: true }
        : { authenticated: false, redirectTo: '/login' };
    } catch {
      return { authenticated: false, redirectTo: '/login' };
    }
  },
  getIdentity: async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) return null;
    const { user } = await res.json();
    return user || null;
  },
};
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
