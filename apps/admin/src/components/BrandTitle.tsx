"use client";
import React from "react";
import { Typography, theme } from "antd";
import { Sparkles } from "lucide-react";

export const BrandTitle: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Sparkles size={20} color={token.colorPrimary} />
      <Typography.Text strong>Imaginaries</Typography.Text>
    </div>
  );
};

