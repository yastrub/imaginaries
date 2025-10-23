import React, { useEffect, useRef, useState } from 'react';
import { History, LogIn, LogOut, Grid, Sparkles, Crown, User, Settings, Bug } from 'lucide-react';
import { Button } from './ui/button';
import { getVersionString } from '../config/app';
import { useToast } from './ui/use-toast';
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
  // Use the isAuthenticated prop passed from parent instead of direct useAuth
  // This ensures consistency with the rest of the app
  const { plan } = useSubscription();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const avatarBtnRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  
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
    let active = true;
    async function loadQuota() {
      if (!isAuthenticated) { setQuota(null); return; }
      try {
        setQuotaLoading(true);
        const res = await fetch('/api/generate/quota', { credentials: 'include' });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setQuota(data);
        } else {
          setQuota(null);
        }
      } catch {
        if (active) setQuota(null);
      } finally {
        if (active) setQuotaLoading(false);
      }
    }
    loadQuota();
    return () => { active = false; };
  }, [isAuthenticated]);

  return (
    <header className="fixed top-0 left-0 right-0 p-4 flex flex-col sm:flex-row items-center justify-between bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm z-50 gap-4 sm:gap-0">
      <div className="font-mono text-zinc-600 text-sm text-center sm:text-left">
        IMAGINARIES (by OctaDiam)
      </div>
      <nav className="flex items-center gap-4">
        {isAuthenticated && (
          <div
            className={`px-2 py-1 rounded-md border text-xs ${quota && quota.limit === null ? 'border-zinc-700 text-zinc-300' : (quota && (quota.remaining ?? 0) === 0 ? 'border-red-600 text-red-400' : 'border-zinc-700 text-zinc-300')} hidden sm:inline-flex items-center gap-2`}
            title="Monthly image quota"
          >
            <span>Left:</span>
            <span>
              {quotaLoading ? '…' : (quota ? (quota.limit === null ? '∞' : Math.max(0, quota.remaining ?? 0)) : '—')}
            </span>
          </div>
        )}
        {isAuthenticated && (
          <Button
            size="sm"
            onClick={() => navigate('/upgrade')}
            className="bg-purple-600 hover:bg-purple-500 text-white gap-2"
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
            <div className="relative" ref={dropdownRef}>
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