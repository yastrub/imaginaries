"use client";
import React from "react";
import { Descriptions, Image as AntImage, theme, Typography } from "antd";
import AdminDate from "./AdminDate";

export type AdminImage = {
  id: string;
  prompt?: string | null;
  user_email?: string;
  is_private?: boolean;
  likes_count?: number | string;
  created_at?: string | null;
  estimated_cost?: string | null;
  image_url?: string | null;
  watermarked_url?: string | null;
};

const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";

function buildSrc(row: AdminImage): string | undefined {
  const filename = row.image_url || row.watermarked_url || undefined;
  if (!filename) return undefined;
  if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
  return ASSETS_BASE ? `${ASSETS_BASE.replace(/\/$/, "")}/images/${filename}` : `/images/${filename}`;
}

// Use centralized AdminDate component for consistent date formatting

function formatEstimatedCost(v?: string | null) {
  if (!v) return "—";
  const numMatch = String(v).replace(/[,\s]/g, '').match(/\d+(?:\.\d+)?/);
  if (numMatch) {
    const num = Math.round(parseFloat(numMatch[0]));
    if (Number.isFinite(num)) return `$${num} USD`;
  }
  return v;
}

export default function ImageDetailsCard({ image }: { image: AdminImage }) {
  const { token } = theme.useToken();
  const src = buildSrc(image);
  return (
    <div>
      {src && (
        <div style={{ marginBottom: 16 }}>
          <AntImage src={src} alt={image.prompt || image.id} width={460} style={{ borderRadius: 8 }} preview />
        </div>
      )}
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Prompt">
          <Typography.Paragraph style={{ margin: 0 }}>{image.prompt || '—'}</Typography.Paragraph>
        </Descriptions.Item>
        <Descriptions.Item label="User">{image.user_email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Private">{image.is_private ? 'Yes' : 'No'}</Descriptions.Item>
        <Descriptions.Item label="Likes">{Number(image.likes_count || 0)}</Descriptions.Item>
        <Descriptions.Item label="Created"><AdminDate value={image.created_at} /></Descriptions.Item>
        <Descriptions.Item label="Estimated Cost">{formatEstimatedCost(image.estimated_cost)}</Descriptions.Item>
      </Descriptions>
    </div>
  );
}
