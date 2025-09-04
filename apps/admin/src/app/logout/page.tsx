"use client";
import React from "react";
import { Result, Button, Space, App as AntApp } from "antd";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  const { message } = AntApp.useApp();

  const doLogout = async () => {
    try {
      await fetch(`/api/auth/signout`, { method: 'POST', credentials: 'include' });
      try { localStorage.removeItem('adminTheme'); } catch {}
      message.success('Signed out');
    } catch {}
    const ts = Date.now();
    window.location.replace(`/login?ts=${ts}`);
  };

  const onCancel = () => {
    router.push('/');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Result
        status="warning"
        title="Sign Out?"
        subTitle="You will be returned to the admin login screen."
        extra={
          <Space>
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="primary" danger onClick={doLogout}>Sign Out</Button>
          </Space>
        }
      />
    </div>
  );
}
