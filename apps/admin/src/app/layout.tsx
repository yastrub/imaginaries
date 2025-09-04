import "./globals.css";
import "antd/dist/reset.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import React, { Suspense } from "react";
import AdminRoot from "./AdminRoot";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <meta name="theme-color" content="#0f0f10" media="(prefers-color-scheme: dark)" />
      <body>
        <AntdRegistry>
          <Suspense>
            <AdminRoot>{children}</AdminRoot>
          </Suspense>
        </AntdRegistry>
      </body>
    </html>
  );
}
