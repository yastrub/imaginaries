"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Tag, Image as AntImage, Typography, Drawer, theme, Spin, Switch, message } from "antd";
import { SearchOutlined, EyeOutlined, InfoCircleOutlined } from "@ant-design/icons";
import ImageDetailsCard, { AdminImage } from "../../components/ImageDetailsCard";
import AdminDate from "../../components/AdminDate";

type ImageRow = {
  id: string;
  user_id: string;
  user_email?: string;
  prompt: string | null;
  image_url: string | null;
  watermarked_url: string | null;
  estimated_cost?: string | null;
  created_at: string | null;
  is_private: boolean;
  likes_count?: number | string;
};

const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function PrivacyToggleCell({ id, initial }: { id: string; initial: boolean }) {
  const [checked, setChecked] = React.useState<boolean>(initial);
  const [loading, setLoading] = React.useState<boolean>(false);
  React.useEffect(() => { setChecked(initial); }, [initial]);
  const onToggle = async (next: boolean) => {
    setChecked(next);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/images/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_private: next }),
      });
      if (!res.ok) throw new Error('Update failed');
      const json = await res.json();
      setChecked(!!json.is_private);
      message.success(`Image set to ${json.is_private ? 'Private' : 'Public'}`);
    } catch (e) {
      setChecked(initial);
      message.error('Failed to update visibility');
    } finally {
      setLoading(false);
    }
  };
  return (
    <Space>
      <Switch checked={checked} loading={loading} onChange={onToggle} size="small" />
      {checked ? <Tag color="red">Private</Tag> : <Tag color="green">Public</Tag>}
    </Space>
  );
}

export default function ImagesList() {
  const [search, setSearch] = React.useState("");
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewRecord, setViewRecord] = React.useState<AdminImage | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const { token } = theme.useToken();

  const { tableProps, setFilters } = useTable<ImageRow>({
    resource: "images",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  // Use AdminDate component for consistent date formatting

  const buildSrc = (row: ImageRow): string | undefined => {
    // Always prefer non-watermarked version for admin
    const filename = row.image_url || row.watermarked_url || undefined;
    if (!filename) return undefined;
    // If ASSETS_BASE is provided, use it. Otherwise pass through as-is, assuming absolute URLs.
    if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
    return ASSETS_BASE ? `${ASSETS_BASE.replace(/\/$/, "")}/images/${filename}` : `/images/${filename}`;
  };

  const openDetails = async (id: string) => {
    try {
      setViewOpen(true);
      setDetailsLoading(true);
      setViewRecord(null);
      const res = await fetch(`${API_BASE}/api/admin/images/${id}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setViewRecord(json);
      } else {
        // fallback to any existing data from table if fetch fails
        const rows = ((tableProps.dataSource as ImageRow[] | undefined) || []);
        const fallback = rows.find(r => r.id === id) as unknown as AdminImage | undefined;
        setViewRecord(fallback || null);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatEstimatedCost = (v?: string | null) => {
    if (!v) return "—";
    const numMatch = String(v).replace(/[,\s]/g, '').match(/\d+(?:\.\d+)?/);
    if (numMatch) {
      const num = Math.round(parseFloat(numMatch[0]));
      if (Number.isFinite(num)) return `$${num} USD`;
    }
    return v;
  };

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Images <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input
          allowClear
          placeholder="Search prompt or user email..."
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
          onPressEnter={onSearch}
          prefix={<SearchOutlined />}
          style={{ width: 320 }}
        />
        <Button type="primary" onClick={onSearch}>Search</Button>
      </Space>
    )}>
      <AntImage.PreviewGroup
        preview={{
          toolbarRender: (node, info) => (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {node}
              <InfoCircleOutlined
                title="Details"
                style={{ color: token.colorPrimary, fontSize: 18, cursor: "pointer" }}
                onClick={() => {
                  const rows = ((tableProps.dataSource as ImageRow[] | undefined) || []);
                  const rec = rows.find(r => {
                    const src = buildSrc(r);
                    return src === info.image.url;
                  });
                  if (rec) {
                    openDetails(rec.id);
                  }
                }}
              />
            </div>
          ),
        }}
      >
      <Table rowKey="id" {...tableProps}>
        <Table.Column<ImageRow>
          title="Preview"
          dataIndex="image_url"
          width={120}
          render={(_: any, row) => {
            const src = buildSrc(row);
            return src ? (
              <AntImage
                src={src}
                alt={row.prompt || row.id}
                width={96}
                height={96}
                style={{ objectFit: "cover", borderRadius: 6 }}
                preview
              />
            ) : null;
          }}
        />
        <Table.Column<ImageRow>
          title="Prompt"
          dataIndex="prompt"
          width={420}
          sorter
          render={(value: string | null, row) => (
            <Typography.Paragraph style={{ margin: 0 }} ellipsis={{ rows: 2, expandable: true, symbol: <span style={{ color: token.colorPrimary, fontWeight: 600 }}>[+]</span> }}>
              {value || "—"}
            </Typography.Paragraph>
          )}
        />
        <Table.Column<ImageRow> dataIndex="user_email" title="User" width={160} sorter />
        <Table.Column<ImageRow>
          dataIndex="is_private"
          title="Private"
          sorter
          render={(v: boolean, row: ImageRow) => (
            <PrivacyToggleCell id={row.id} initial={v} />
          )}
        />
        <Table.Column<ImageRow>
          dataIndex="likes_count"
          title="Likes"
          width={100}
          sorter
          render={(v?: number | string) => Number(v || 0)}
        />
        <Table.Column<ImageRow>
          dataIndex="created_at"
          title="Created"
          width={220}
           sorter
          render={(v: string | null) => (<AdminDate value={v} />)}
        />
        <Table.Column<ImageRow>
          title="Actions"
          render={(_: any, row: ImageRow) => (
            <Button icon={<EyeOutlined />} onClick={() => openDetails(row.id)}>View</Button>
          )}
        />
      </Table>
      </AntImage.PreviewGroup>

      <Drawer title={viewRecord ? `Image: ${viewRecord.id}` : 'Image'} open={viewOpen} onClose={() => setViewOpen(false)} width={510} destroyOnClose zIndex={token.zIndexPopupBase + 1000}>
        {detailsLoading || !viewRecord ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: "100%" }}>
            <Spin />
          </div>
        ) : (
          <ImageDetailsCard image={viewRecord as AdminImage} />
        )}
      </Drawer>
    </List>
  );
}
