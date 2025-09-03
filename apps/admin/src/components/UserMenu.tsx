"use client";
import React from "react";
import { Avatar, Dropdown, MenuProps, Space, Typography, App as AntApp } from "antd";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export const UserMenu: React.FC = () => {
  const [user, setUser] = React.useState<any>(null);
  const { modal, message } = AntApp.useApp();

  React.useEffect(() => {
    fetch(`/api/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const onSignOut = () => {
    modal.confirm({
      title: 'Sign Out?',
      content: 'You will be returned to the admin login screen.',
      okText: 'Sign Out',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetch(`/api/auth/signout`, { method: 'POST', credentials: 'include' });
          try { localStorage.removeItem('adminTheme'); } catch {}
          message.success('Signed out');
        } catch {}
        window.location.replace(`/login?ts=${Date.now()}`);
      }
    });
  };

  const items: MenuProps['items'] = [
    { key: 'email', label: <span style={{ color: '#888' }}>{user?.email}</span>, disabled: true },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', onClick: onSignOut },
  ];

  return (
    <Dropdown menu={{ items }} placement="bottomRight" trigger={["click"]}>
      <Space style={{ cursor: 'pointer' }}>
        <Avatar size={28} icon={<UserOutlined />} />
        <Typography.Text>{user?.email || '—'}</Typography.Text>
      </Space>
    </Dropdown>
  );
};

