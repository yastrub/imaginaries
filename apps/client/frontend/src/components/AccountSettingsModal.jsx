import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, Mail, Lock, Receipt, User as UserIcon, ExternalLink, Loader2, CircleFadingArrowUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { useToast } from './ui/use-toast';
import { Button } from './ui/button';

export default function AccountSettingsModal({ open, onClose }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState(null); // { user: { id, email, email_confirmed, subscription_plan, role_id, role_name } }
  const [sub, setSub] = useState(null); // { subscription_plan, subscription_updated_at, plan_details }
  const [isMobile, setIsMobile] = useState(false);

  // Local form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [pendingEmail, setPendingEmail] = useState(''); // in-memory new email until confirmed

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Button processing states
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    // Determine viewport for responsive orientation
    const mq = window.matchMedia('(max-width: 768px)');
    const setMq = () => setIsMobile(mq.matches);
    setMq();
    mq.addEventListener?.('change', setMq);
    // Fallback for older Safari
    mq.addListener?.(setMq);
    (async () => {
      try {
        setLoading(true);
        // Fetch current user
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load account');
        const data = await res.json();
        if (!mounted) return;
        setMe(data);

        // Initialize profile names if present
        setFirstName(data?.user?.first_name || '');
        setLastName(data?.user?.last_name || '');

        if (data?.user?.id) {
          // Load subscription
          const s = await fetch(`/api/users/${data.user.id}`, { credentials: 'include' });
          if (s.ok) {
            const sj = await s.json();
            if (mounted) setSub(sj);
          }
        }
      } catch (e) {
        console.error(e);
        toast({ title: 'Account', description: 'Failed to load account data', variant: 'destructive' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      mq.removeEventListener?.('change', setMq);
      mq.removeListener?.(setMq);
    };
  }, [open, toast]);

  const planName = useMemo(() => {
    return sub?.subscription_plan || me?.user?.subscription_plan || 'free';
  }, [sub, me]);

  const [canUpgrade, setCanUpgrade] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/plans', { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json?.data) ? json.data : [];
          if (data.length) {
            const maxSort = Math.max(...data.map(p => p.sortOrder ?? 0));
            const userPlan = data.find(p => p.key === planName);
            const atTop = !!userPlan && (userPlan.sortOrder ?? 0) >= maxSort;
            setCanUpgrade(!atTop);
          } else {
            setCanUpgrade(true);
          }
        } else {
          setCanUpgrade(true);
        }
      } catch {
        if (mounted) setCanUpgrade(true);
      }
    })();
    return () => { mounted = false; };
  }, [planName]);

  const usage = useMemo(() => {
    const limit = sub?.effective_limit ?? 0;
    const count = sub?.monthly_generation_count ?? 0;
    const left = Math.max(0, (limit || 0) - (count || 0));
    const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
    const resetAt = sub?.next_reset_at ? new Date(sub.next_reset_at) : null;
    return { limit, count, left, pct, resetAt };
  }, [sub]);

  if (!open) return null;

  const close = () => {
    if (typeof onClose === 'function') onClose();
  };

  // Handlers wired to backend APIs
  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ first_name: firstName, last_name: lastName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update profile');
      // Update local state
      setMe((prev) => prev ? { ...prev, user: { ...prev.user, first_name: data.user?.first_name ?? firstName, last_name: data.user?.last_name ?? lastName } } : prev);
      toast({ title: 'Profile', description: 'Profile updated' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Profile', description: e.message || 'Failed to update profile', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSendEmailConfirmation = async () => {
    try {
      if (!pendingEmail) {
        toast({ title: 'Email', description: 'Enter a new email' });
        return;
      }
      setSendingEmail(true);
      const res = await fetch('/api/profile/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_email: pendingEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send confirmation');
      toast({ title: 'Email', description: data?.message || 'Confirmation link sent to new email' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Email', description: e.message || 'Failed to send confirmation', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!newPassword || newPassword.length < 8) {
        toast({ title: 'Security', description: 'Password must be at least 8 characters', variant: 'destructive' });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({ title: 'Security', description: 'Passwords do not match', variant: 'destructive' });
        return;
      }
      setChangingPassword(true);
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update password');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Security', description: data?.message || 'Password updated' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Security', description: e.message || 'Failed to update password', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const modalNode = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={close} />
      <div className="relative w-full max-w-4xl mx-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden h-full max-h-[45vh] min-h-[20vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2 text-white">
            <Settings className="w-4 h-4 text-purple-400" />
            <h3 className="text-base font-semibold">Account Settings</h3>
          </div>
          <button onClick={close} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body with a single Tabs root */}
        <div className="flex-1 overflow-hidden pt-2 min-h-0">
        <Tabs defaultValue="profile" orientation={isMobile ? 'horizontal' : 'vertical'} className="h-full flex flex-col">
          {/* Mobile horizontal tabs below header */}
          <div className="md:hidden px-4 pb-2 border-b border-zinc-800">
            <TabsList className="flex flex-row gap-2 bg-transparent p-0 h-auto">
              <TabsTrigger value="profile" className="text-xs px-2 py-1 text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">Name</TabsTrigger>
              <TabsTrigger value="email" className="text-xs px-2 py-1 text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">Email</TabsTrigger>
              <TabsTrigger value="security" className="text-xs px-2 py-1 text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">Security</TabsTrigger>
              <TabsTrigger value="subscription" className="text-xs px-2 py-1 text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">Subscription</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex-1 flex h-full items-stretch min-h-0">
            {/* Vertical tabs */}
            <div className="hidden md:block h-full w-56 shrink-0 px-0 pb-0 pt-0">
              <div className="flex h-full flex-col border-r border-zinc-800 px-3 pb-3 pt-0">
              <TabsList className="flex flex-col gap-2 bg-transparent p-0 h-auto">
                <TabsTrigger value="profile" className="justify-start w-full text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">
                  <UserIcon className="w-4 h-4 mr-2" /> Name
                </TabsTrigger>
                <TabsTrigger value="email" className="justify-start w-full text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">
                  <Mail className="w-4 h-4 mr-2" /> Email
                </TabsTrigger>
                <TabsTrigger value="security" className="justify-start w-full text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">
                  <Lock className="w-4 h-4 mr-2" /> Security
                </TabsTrigger>
                <TabsTrigger value="subscription" className="justify-start w-full text-zinc-300 data-[state=active]:bg-purple-600/20 data-[state=active]:text-white">
                  <Receipt className="w-4 h-4 mr-2" /> Subscription
                </TabsTrigger>
              </TabsList>
              </div>
            </div>

            {/* Tab contents */}
            <div className="flex-1 p-5 overflow-auto">
              {/* Name */}
              <TabsContent value="profile">
                <div className="mb-3 text-sm text-zinc-400">Your name will be visible under your images in public gallery.</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">First Name</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" placeholder="Jane" />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Last Name</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" placeholder="Doe" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button disabled={savingProfile} className="bg-purple-600 hover:bg-purple-500 text-white gap-2 inline-flex items-center" onClick={handleSaveProfile}>
                    {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save name
                  </Button>
                </div>
              </TabsContent>

              {/* Email */}
              <TabsContent value="email">
                <div className="space-y-3">
                  <div className="text-sm text-zinc-400">Current email</div>
                  <div className="text-white">{me?.user?.email || '—'}</div>
                  <div className="h-px bg-zinc-800 my-2" />
                  <label className="block text-sm text-zinc-400 mb-1">New email</label>
                  <input type="email" value={pendingEmail} onChange={(e) => setPendingEmail(e.target.value)} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" placeholder="jane.new@example.com" />
                  <p className="text-xs text-zinc-500">We will send a confirmation link to the new address. Your email will change only after confirmation.</p>
                  <div className="flex justify-end">
                    <Button disabled={sendingEmail} className="bg-purple-600 hover:bg-purple-500 text-white gap-2 inline-flex items-center" onClick={handleSendEmailConfirmation}>
                      {sendingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send confirmation
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-zinc-400 mb-1">Current password</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">New password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" placeholder="At least 8 characters" />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Confirm new password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-white" placeholder="Repeat new password" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button disabled={changingPassword} className="bg-purple-600 hover:bg-purple-500 text-white gap-2 inline-flex items-center" onClick={handleChangePassword}>
                    {changingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update password
                  </Button>
                </div>
              </TabsContent>

              {/* Subscription */}
              <TabsContent value="subscription">
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-xl border border-purple-600 bg-gradient-to-br from-zinc-900 to-zinc-900/40 p-5">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                      <div>
                        <div className="text-sm text-zinc-400">Images left</div>
                        <div className="mt-1 text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-300 bg-clip-text text-transparent">
                          {usage.left}
                        </div>
                        <div className="mt-1 text-xs text-zinc-400">
                          {usage.count} used · {usage.limit} total
                          {usage.resetAt ? (
                            <span className="ml-2 text-zinc-500">· resets {usage.resetAt.toLocaleDateString()}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="w-full md:w-1/2">
                        <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-400"
                            style={{ width: `${usage.pct}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                          <span>{usage.pct}% used</span>
                          <span>{Math.max(0, usage.limit - usage.count)} left</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-zinc-400">Current plan</div>
                      <div className="text-white capitalize font-medium">{planName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canUpgrade && (
                        <Button onClick={() => { window.location.href = '/upgrade'; }} className="bg-purple-600 hover:bg-purple-500 text-white gap-2">
                          Upgrade
                          <CircleFadingArrowUp className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        disabled={openingPortal}
                        onClick={async () => {
                          try {
                            setOpeningPortal(true);
                            const res = await fetch('/api/billing/portal', { method: 'POST', credentials: 'include' });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok && data?.url) {
                              window.open(data.url, '_blank', 'noopener,noreferrer');
                            } else {
                              throw new Error(data?.error || 'Failed to open billing portal');
                            }
                          } catch (e) {
                            toast({ title: 'Billing', description: e.message || 'Could not open billing portal', variant: 'destructive' });
                          } finally {
                            setOpeningPortal(false);
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white gap-2"
                      >
                        Manage
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="h-px bg-zinc-800" />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-zinc-400">Billing</div>
                      <div className="text-white font-medium">Payments &amp; Invoices</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        disabled={openingPortal}
                        onClick={async () => {
                          try {
                            setOpeningPortal(true);
                            const res = await fetch('/api/billing/portal', { method: 'POST', credentials: 'include' });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok && data?.url) {
                              window.open(data.url, '_blank', 'noopener,noreferrer');
                            } else {
                              throw new Error(data?.error || 'Failed to open billing portal');
                            }
                          } catch (e) {
                            toast({ title: 'Billing', description: e.message || 'Could not open billing portal', variant: 'destructive' });
                          } finally {
                            setOpeningPortal(false);
                          }
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 gap-2"
                      >
                        Billing Settings
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
        </div>
      </div>
    </div>
  );
  return createPortal(modalNode, document.body);
}
