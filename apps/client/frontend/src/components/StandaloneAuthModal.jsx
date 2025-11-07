import React, { useState, useRef, useEffect, memo } from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import ReactDOM from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { cn } from '@/lib/utils';

// Standalone Auth component that's completely isolated from parent components
const StandaloneAuth = memo(function StandaloneAuth({ onClose, toast }) {
  const formRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [error, setError] = useState(null);
  const { login, register } = useReduxAuth();

  const shakeForm = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 820);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const authFunction = isSignUp ? register : login;
      const result = await authFunction(email, password);
      
      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      if (result.requiresConfirmation) {
        if (onClose) onClose();
        return;
      }

      if (onClose) onClose();
    } catch (error) {
      setError(error.message);
      shakeForm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-zinc-900 rounded-xl shadow-xl relative">
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-white"
          disabled={loading}
        >
          <X className="w-5 h-5" />
        </Button>
      )}

      <h2 className="text-2xl font-bold text-white mb-6">
        {isSignUp ? 'Create an account' : 'Sign in / Sign up'}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      <form 
        ref={formRef}
        onSubmit={handleSubmit} 
        className={cn(
          "space-y-4 transition-transform",
          isShaking && "animate-shake"
        )}
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50"
            required
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-10 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isSignUp ? 'Creating account...' : 'Signing in...'}
            </>
          ) : (
            isSignUp ? 'Sign up' : 'Sign in'
          )}
        </Button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={() => {
            if (loading) return;
            setIsSignUp(!isSignUp);
            setError(null);
          }}
          className="text-zinc-400 hover:text-white text-sm disabled:opacity-50"
          disabled={loading}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
});

// Completely standalone modal that creates its own portal
export const StandaloneAuthModal = memo(({ isOpen, onClose }) => {
  const { toast } = { toast: () => {} }; // Dummy toast function if not provided
  const [modalRoot, setModalRoot] = useState(null);
  const overlayStyle = useViewportOverlay();

  useEffect(() => {
    // Create a div for the modal portal
    let modalRootElement = document.getElementById('auth-modal-root');
    if (!modalRootElement) {
      modalRootElement = document.createElement('div');
      modalRootElement.id = 'auth-modal-root';
      document.body.appendChild(modalRootElement);
    }
    setModalRoot(modalRootElement);

    // Cleanup
    return () => {
      if (modalRootElement && modalRootElement.parentNode === document.body) {
        document.body.removeChild(modalRootElement);
      }
    };
  }, []);

  if (!isOpen || !modalRoot) return null;

  return ReactDOM.createPortal(
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]" style={overlayStyle}>
      <StandaloneAuth onClose={onClose} toast={toast} />
    </div>,
    modalRoot
  );
});
