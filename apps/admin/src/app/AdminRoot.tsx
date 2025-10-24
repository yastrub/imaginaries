"use client";
import "antd/dist/reset.css";
import { Refine, Authenticated } from "@refinedev/core";
import { useNotificationProvider, ThemedLayout, ThemedSider } from "@refinedev/antd";
import routerProvider from "@refinedev/nextjs-router";
import { dataProvider } from "../providers/dataProvider";
import { authProvider } from "../providers/authProvider";
import { App as AntApp, ConfigProvider, theme } from "antd";
import { DashboardOutlined, PictureOutlined, AppstoreOutlined, TagsOutlined, GiftOutlined, CreditCardOutlined, FileTextOutlined, UsergroupAddOutlined, SafetyCertificateOutlined, TeamOutlined, DesktopOutlined, DollarOutlined } from "@ant-design/icons";
import React from "react";
import { BrandTitle } from "../components/BrandTitle";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { UserMenu } from "../components/UserMenu";
import { usePathname, useRouter } from "next/navigation";

const FallbackRedirect: React.FC = () => {
  const router = useRouter();
  const { token } = theme.useToken();
  const bgColor = token.colorBgLayout;
  React.useEffect(() => {
    router.replace('/login');
  }, [router]);
  return <div>Redirecting...</div>;
};

const AdminMenuTitle: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <div className="admin-menu-title" style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
      <AppstoreOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
      <span className="title-text" style={{ marginLeft: 8 }}>Control Panel</span>
    </div>
  );
};

const CustomSider: React.FC<any> = (props) => {
  return <ThemedSider {...props} />;
};

// Blank dark-themed screen to avoid flashing content while auth is loading
const BlankScreen: React.FC = () => {
  const { token } = theme.useToken();
  return <div style={{ minHeight: '100dvh', background: token.colorBgBase }} />;
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicLogin = pathname === "/login";
  const [dark, setDark] = React.useState(true);
  const notificationProvider = useNotificationProvider();
  React.useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('adminTheme') : null;
      if (saved === 'light') setDark(false);
      else if (saved === 'dark') setDark(true);
    } catch { /* noop */ }
  }, []);
  const onThemeChange = (v: boolean) => {
    setDark(v);
    try { localStorage.setItem('adminTheme', v ? 'dark' : 'light'); } catch { /* noop */ }
  };

  return (
    <ConfigProvider theme={{ algorithm: isPublicLogin ? theme.darkAlgorithm : (dark ? theme.darkAlgorithm : theme.defaultAlgorithm), token: { borderRadius: 8, colorPrimary: "#7c3aed" } }}>
      <AntApp>
        <Refine
          dataProvider={dataProvider}
          authProvider={authProvider}
          notificationProvider={notificationProvider}
          routerProvider={routerProvider}
          resources={[
            { name: "dashboard", list: "/", meta: { label: "Dashboard", icon: <DashboardOutlined /> } },
            { name: "images", list: "/images", meta: { label: "Images", icon: <PictureOutlined /> } },
            { name: "plans", list: "/plans", meta: { label: "Plans", icon: <TagsOutlined /> } },
            { name: "orders", list: "/orders", meta: { label: "Orders", icon: <DollarOutlined /> } },
            { name: "promo_codes", list: "/promo-codes", meta: { label: "Promo Codes", icon: <GiftOutlined /> } },
            { name: "subscriptions", list: "/subscriptions", meta: { label: "Subscriptions", icon: <CreditCardOutlined /> } },
            { name: "invoices", list: "/invoices", meta: { label: "Invoices", icon: <FileTextOutlined /> } },
            { name: "users", list: "/users", meta: { label: "Users", icon: <UsergroupAddOutlined /> } },
            { name: "roles", list: "/roles", meta: { label: "Roles", icon: <SafetyCertificateOutlined /> } },
            { name: "partners", list: "/partners", meta: { label: "Partners", icon: <DollarOutlined /> } },
            { name: "terminals", list: "/terminals", meta: { label: "Terminals", icon: <DesktopOutlined /> } },
            { name: "ai", list: "/ai", meta: { label: "AI", icon: <AppstoreOutlined /> } },
            { name: "presets", list: "/presets", meta: { label: "Presets", icon: <AppstoreOutlined /> } },
          ]}
        >
          {isPublicLogin ? (
            <>{children}</>
          ) : (
            <React.Suspense fallback={<BlankScreen />}>
              <Authenticated key="auth-guard" redirectOnFail="/login" fallback={<FallbackRedirect />}>
                <ThemedLayout Title={AdminMenuTitle} Sider={CustomSider} Header={() => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 64 }}>
                    <BrandTitle />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <ThemeSwitch checked={dark} onChange={onThemeChange} />
                      <UserMenu />
                    </div>
                  </div>
                )}>
                  {children}
                </ThemedLayout>
              </Authenticated>
            </React.Suspense>
          )}
        </Refine>
      </AntApp>
    </ConfigProvider>
  );
}
