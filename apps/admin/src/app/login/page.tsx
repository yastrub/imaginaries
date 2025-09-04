"use client";
import React from "react";
import { Card, Form, Input, Button, Typography, message } from "antd";

// Prefer internal Next route handlers by default (relative calls).
// If NEXT_PUBLIC_API_URL is set, use it to point to an external admin API.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || '';

export default function LoginPage() {
  const [loading, setLoading] = React.useState(true);
  const [overlay, setOverlay] = React.useState(true);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Check if user is already authenticated
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/session`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            window.location.href = '/';
            return;
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
        setOverlay(false);
      }
    };

    checkAuth();
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let timeout: any;
    const onReady = () => { if (mounted) setOverlay(false); };
    const v = videoRef.current;
    if (v) {
      v.addEventListener('loadeddata', onReady, { once: true });
      v.addEventListener('canplaythrough', onReady, { once: true });
    }
    // Fallback: hide after 1500ms in case the video is slow or blocked
    timeout = setTimeout(onReady, 1500);
    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (v) {
        v.removeEventListener('loadeddata', onReady);
        v.removeEventListener('canplaythrough', onReady);
      }
    };
  }, []);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      // Update auth state and redirect
      setIsAuthenticated(true);
      window.location.href = '/';
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed. Please try again.';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }}>
      {/* Background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', objectFit: 'cover', zIndex: 0 }}
      >
        <source src={`${ASSETS_BASE}/video/imaginaries-intro.webm`} type="video/webm" />
        {/* Optional MP4 fallback if provided later */}
        <source src={`${ASSETS_BASE}/video/imaginaries-intro.mp4`} type="video/mp4" />
      </video>
      {/* Dark overlay for readability */}
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.55))', zIndex: 0 }} />

      {!overlay && !loading && !isAuthenticated && (
        <Card title="Sign In" style={{ width: 360, background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
          <Typography.Paragraph type="secondary">
            Imaginaries Control Center
          </Typography.Paragraph>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}> 
              <Input placeholder="you@example.com" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true }]}> 
              <Input.Password placeholder="••••••••" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Sign In</Button>
          </Form>
        </Card>
      )}

      {(overlay || loading || isAuthenticated) && (
        <div className="login-overlay">
          <div className="loader-ring" />
        </div>
      )}
    </div>
  );
}