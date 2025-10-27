import React, { useEffect, useMemo, useRef, useState } from 'react';
import { History, LogIn, LogOut, Grid, Sparkles, Crown, User, Settings, Bug } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { useSelector } from 'react-redux';
// Authentication is handled via props instead of direct hook usage
import { useSubscription } from '../hooks/useSubscription';
import { openAuthModal } from './CompletelyIsolatedAuth';
import { useNavigate } from 'react-router-dom';
import AccountSettingsModal from './AccountSettingsModal';
import { BugReportModal } from './BugReportModal';

export const Header = React.memo(function Header({
  onOpenHistory,
  onSignOut,
  onSignIn,
  onToggleGallery,
  isAuthenticated,
  showGallery
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);
  const terminalName = useSelector((state) => state?.env?.terminalName);
  // Use the isAuthenticated prop passed from parent instead of direct useAuth
  // This ensures consistency with the rest of the app
  const { plan } = useSubscription();
  const [canUpgrade, setCanUpgrade] = useState(false);
  const [plansList, setPlansList] = useState([]);
  const [currentPlanKey, setCurrentPlanKey] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const avatarBtnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [titleTapCount, setTitleTapCount] = useState(0);
  const [showBuildVersion, setShowBuildVersion] = useState(false);
  const titleTapTimer = useRef(null);
  const allowHideAt = useRef(0);
  const suppressClickUntil = useRef(0);
  const [serverBuildId, setServerBuildId] = useState(null);
  
  // Determine if we're on a gallery page based on the current path
  const isGalleryPage = window.location.pathname.startsWith('/gallery');

  const handleGalleryToggle = () => {
    console.log('Gallery toggle clicked, isAuthenticated:', isAuthenticated);
    
    const currentPath = window.location.pathname;
    
    // Special-case: On upgrade page, default action should be to go to Imagine
    if (currentPath === '/upgrade') {
      if (isAuthenticated) {
        navigate('/imagine');
      } else {
        navigate('/');
      }
      return;
    }

    // Main route (/) behavior depends on authentication and showGallery state
    if (currentPath === '/' || currentPath === '') {
      // If user is not authenticated, toggle gallery view on main screen
      if (!isAuthenticated) {
        console.log('Main route: Toggling gallery view');
        if (typeof onToggleGallery === 'function') {
          onToggleGallery();
        }
      } 
      // If user is authenticated, navigate to /imagine
      else {
        console.log('Authenticated on main route: Navigating to /imagine');
        navigate('/imagine');
      }
    }
    // If we're on the /imagine route, navigate to the gallery
    else if (currentPath === '/imagine') {
      console.log('Navigating from /imagine to /gallery');
      // Store a flag in sessionStorage to trigger data loading after navigation
      sessionStorage.setItem('galleryNavigation', JSON.stringify({
        timestamp: Date.now(),
        view: 'recent',
        forcePublic: true
      }));
      navigate('/gallery');
    } 
    // If we're on the gallery route, navigate to the imagine route if authenticated
    else if (currentPath.startsWith('/gallery')) {
      if (isAuthenticated) {
        console.log('Navigating from /gallery to /imagine');
        navigate('/imagine');
      } else {
        console.log('Not authenticated, navigating from /gallery to /');
        navigate('/');
      }
    }
    // For other routes, use the toggle function
    else {
      console.log('Calling onToggleGallery');
      if (typeof onToggleGallery === 'function') {
        onToggleGallery();
      } else {
        console.warn('onToggleGallery is not a function');
      }
    }
  };
  
  // Add debug handlers for the other buttons
  const handleHistoryClick = () => {
    console.log('History button clicked');
    if (typeof onOpenHistory === 'function') {
      onOpenHistory();
    } else {
      console.warn('onOpenHistory is not a function');
    }
  };
  
  const handleSignOutClick = () => {
    console.log('Sign out button clicked');
    setIsDropdownOpen(false);
    if (typeof onSignOut === 'function') {
      onSignOut();
    } else {
      console.warn('onSignOut is not a function');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      const btn = avatarBtnRef.current;
      const menu = dropdownRef.current;
      if (!btn && !menu) return;
      const target = e.target;
      if (btn && btn.contains(target)) return;
      if (menu && menu.contains(target)) return;
      if (isDropdownOpen) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isDropdownOpen]);

  

  useEffect(() => {
    let mounted = true;
    async function loadUserPlan() {
      try {
        if (!isAuthenticated) { setCurrentPlanKey(null); return; }
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setCurrentPlanKey(data?.user?.subscription_plan || null);
        } else {
          setCurrentPlanKey(null);
        }
      } catch {
        if (mounted) setCurrentPlanKey(null);
      }
    }
    loadUserPlan();
    return () => { mounted = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;
    async function loadPlansAndCompute() {
      try {
        const res = await fetch('/api/plans', { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json();
          const data = Array.isArray(json?.data) ? json.data : [];
          setPlansList(data);
          if (data.length) {
            const userPlanKey = currentPlanKey || null;
            const userPlan = userPlanKey ? data.find(p => p.key === userPlanKey) : null;
            const maxSort = Math.max(...data.map(p => p.sortOrder ?? 0));
            const atTop = !!userPlan && (userPlan.sortOrder ?? 0) >= maxSort;
            const isTerminalPlan = !!userPlan && typeof userPlan.key === 'string' && /terminal/i.test(userPlan.key);
            const isPublicPlan = !!userPlan && (
              userPlan.isPublic === true || userPlan.public === true || userPlan.is_public === true
            );
            const can = !!userPlan && !atTop && !isTerminalPlan && isPublicPlan;
            setCanUpgrade(can);
          } else {
            // Unknown plan list -> don't show Upgrade by default
            setCanUpgrade(false);
          }
        } else {
          // Unknown eligibility -> hide
          setCanUpgrade(false);
        }
      } catch {
        if (mounted) setCanUpgrade(false);
      }
    }
    loadPlansAndCompute();
    return () => { mounted = false; };
  }, [currentPlanKey, isAuthenticated]);

  const planDisplayName = useMemo(() => {
    if (!isAuthenticated) return null;
    const match = plansList.find(p => p.key === currentPlanKey);
    if (match?.name) return match.name;
    if (currentPlanKey) {
      const raw = String(currentPlanKey);
      return raw
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return 'Free';
  }, [isAuthenticated, plansList, currentPlanKey]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!showBuildVersion || serverBuildId) return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store', credentials: 'include' });
        if (!res.ok) throw new Error('version failed');
        const et = res.headers.get('ETag') || res.headers.get('etag') || res.headers.get('Etag');
        const json = await res.json().catch(() => ({}));
        const buildId = json?.buildId || et || null;
        if (!aborted) setServerBuildId(buildId);
      } catch {}
    })();
    return () => { aborted = true; };
  }, [showBuildVersion, serverBuildId]);

  const buildVersionLabel = useMemo(() => {
    if (serverBuildId) return serverBuildId;
    try { if (window && window.__BUILD_ID__) return String(window.__BUILD_ID__); } catch {}
    return 'unknown';
  }, [serverBuildId]);

  const handleTitleTap = (e) => {
    const now = Date.now();
    if (now < suppressClickUntil.current) return;
    if (showBuildVersion) {
      if (now >= allowHideAt.current) {
        setShowBuildVersion(false);
      }
      return;
    }
    const next = titleTapCount + 1;
    setTitleTapCount(next);
    if (titleTapTimer.current) clearTimeout(titleTapTimer.current);
    titleTapTimer.current = setTimeout(() => { setTitleTapCount(0); }, 1500);
    if (next >= 5) {
      setShowBuildVersion(true);
      setTitleTapCount(0);
      if (titleTapTimer.current) { clearTimeout(titleTapTimer.current); titleTapTimer.current = null; }
      allowHideAt.current = now + 1500; // cooldown before allowing hide
      suppressClickUntil.current = now + 300; // absorb immediate ghost click after touch
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 p-4 flex flex-col sm:flex-row items-center justify-between bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm z-50 gap-4 sm:gap-0">
      <div className="font-mono text-zinc-600 text-sm text-center sm:text-left" onClick={handleTitleTap} onTouchEnd={handleTitleTap}>
        {showBuildVersion
          ? (`Build ${buildVersionLabel}`)
          : (isTerminalApp
              ? (<>
                  {`IMAGINARIUM${terminalName ? ` (${terminalName})` : ''}`}
                </>)
              : (<>IMAGINARIES ({isAuthenticated ? planDisplayName : 'OctaDiam'})</>)
            )}
      </div>
      <nav className="flex items-center gap-4">
        
        {isAuthenticated && !isTerminalApp && canUpgrade && (
          <Button
            size="sm"
            onClick={() => navigate('/upgrade')}
            className="bg-purple-600 hover:bg-purple-500 text-white gap-2"
            data-hide-in-terminal="true"
          >
            <Crown className="w-4 h-4" />
            Upgrade
          </Button>
        )}
        {isAuthenticated ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGalleryToggle}
              className="text-zinc-400 hover:text-white gap-2"
            >
              {window.location.pathname.startsWith('/gallery') ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Imagine
                </>
              ) : window.location.pathname === '/imagine' ? (
                <>
                  <Grid className="w-4 h-4" />
                  Gallery
                </>
              ) : window.location.pathname === '/upgrade' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Imagine
                </>
              ) : showGallery ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Imagine
                </>
              ) : (
                <>
                  <Grid className="w-4 h-4" />
                  Gallery
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHistoryClick}
              className="text-zinc-400 hover:text-white gap-2"
            >
              <History className="w-4 h-4" />
              My Jewelry
            </Button>
            {/* Avatar dropdown (last item) */}
            {!isTerminalApp && (
              <div className="relative" ref={dropdownRef} data-hide-in-terminal="true">
                <button
                  ref={avatarBtnRef}
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700 hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
                  aria-haspopup="menu"
                  aria-expanded={isDropdownOpen}
                >
                  <User className="w-4 h-4" />
                </button>
                {isDropdownOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-48 rounded-md bg-zinc-900 border border-zinc-700 shadow-lg overflow-hidden z-50"
                  >
                    <button
                      role="menuitem"
                      onClick={() => { setIsDropdownOpen(false); setIsAccountModalOpen(true); }}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Account Settings
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setIsDropdownOpen(false); setIsBugModalOpen(true); }}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <Bug className="w-4 h-4" />
                      Report a Bug
                    </button>
                    <button
                      role="menuitem"
                      onClick={handleSignOutClick}
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-800 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={openAuthModal}
            className="text-zinc-400 hover:text-white gap-2"
          >
            <LogIn className="w-4 h-4" />
            Sign in
          </Button>
        )}
      </nav>
      <AccountSettingsModal open={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} />
      {isBugModalOpen && (
        <BugReportModal isOpen={isBugModalOpen} onClose={() => setIsBugModalOpen(false)} />
      )}
    </header>
  );
});