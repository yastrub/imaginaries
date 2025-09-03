import "./globals.css";
import "antd/dist/reset.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import React, { Suspense } from "react";
import AdminRoot from "./AdminRoot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#0f0f10' }} />}>
            <AdminRoot>{children}</AdminRoot>
          </Suspense>
        </AntdRegistry>
      </body>
    </html>
  );
}
