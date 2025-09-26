"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Drawer, Form, InputNumber, Tag, Image as AntImage, Spin, theme } from "antd";
import { useUpdate } from "@refinedev/core";
import { EditOutlined, SearchOutlined, InfoCircleOutlined } from "@ant-design/icons";
import AdminDate from "../../components/AdminDate";
import ImageDetailsCard, { AdminImage } from "../../components/ImageDetailsCard";
import { ZoomIn } from "lucide-react";

type Order = {
  id: string;
  user_id: string;
  user_email?: string | null;
  image_id: string;
  notes?: string | null;
  estimated_price_text?: string | null;
  actual_price_cents?: number | null;
  created_at: string;
  updated_at: string;
  image_url?: string | null;
  watermarked_url?: string | null;
  prompt?: string | null;
};

function formatPriceCents(cents?: number | null) {
  if (cents == null) return "—";
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} USD`;
  }
}

function formatEstimatedText(v?: string | null) {
  if (!v) return '—';
  const numMatch = String(v).replace(/[\,\s]/g, '').match(/\d+(?:\.\d+)?/);
  if (numMatch) {
    const num = Math.round(parseFloat(numMatch[0]));
    if (Number.isFinite(num)) return `$${num} USD`;
  }
  return v;
}

export default function OrdersPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<Order | null>(null);
  const [form] = Form.useForm();
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewRecord, setViewRecord] = React.useState<AdminImage | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [userOpen, setUserOpen] = React.useState(false);
  const [userDetails, setUserDetails] = React.useState<any | null>(null);
  const [userLoading, setUserLoading] = React.useState(false);
  const { token } = theme.useToken();
  const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  const { tableProps, setFilters } = useTable<Order>({
    resource: "orders",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const { mutateAsync: update } = useUpdate();

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  const onEdit = (row: Order) => {
    setRecord(row);
    setOpen(true);
    setTimeout(() => {
      form.setFieldsValue({
        notes: row.notes || "",
        actual_price_dollars: row.actual_price_cents ? (row.actual_price_cents / 100) : undefined,
      });
    }, 0);
  };

  const onSubmit = async (values: any) => {
    if (!record) return;
    const payload: any = {
      notes: values.notes || null,
      actual_price_cents: values.actual_price_dollars != null ? Math.round(Number(values.actual_price_dollars) * 100) : null,
    };
    await update({ resource: 'orders', id: record.id, values: payload });
    setOpen(false);
    setRecord(null);
    form.resetFields();
  };

  const buildSrc = (row: Partial<Order>): string | undefined => {
    const filename = row.image_url || row.watermarked_url || undefined;
    if (!filename) return undefined;
    if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
    return ASSETS_BASE ? `${ASSETS_BASE.replace(/\/$/, "")}/images/${filename}` : `/images/${filename}`;
  };

  const openImageDetails = async (imageId: string) => {
    try {
      setViewOpen(true);
      setDetailsLoading(true);
      setViewRecord(null);
      const res = await fetch(`${API_BASE}/api/admin/images/${imageId}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setViewRecord(json);
      } else {
        const rows = ((tableProps.dataSource as Order[] | undefined) || []);
        const fallback = rows.find(r => r.image_id === imageId) as unknown as AdminImage | undefined;
        setViewRecord(fallback || null);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openUserDetails = async (userId: string) => {
    try {
      setUserOpen(true);
      setUserLoading(true);
      setUserDetails(null);
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, { credentials: 'include' });
      if (res.ok) {
        setUserDetails(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Orders <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search user/image..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
      </Space>
    )}>
      <AntImage.PreviewGroup
        preview={{
          toolbarRender: (node, info) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {node}
              <InfoCircleOutlined
                title="Details"
                style={{ color: token.colorPrimary, fontSize: 18, cursor: 'pointer' }}
                onClick={() => {
                  const rows = ((tableProps.dataSource as Order[] | undefined) || []);
                  const rec = rows.find(r => buildSrc(r) === info.image.url);
                  if (rec) openImageDetails(rec.image_id);
                }}
              />
            </div>
          ),
        }}
      >
      <Table rowKey="id" {...tableProps}>
        <Table.Column<Order>
          title="Preview"
          dataIndex="image_url"
          width={120}
          render={(_: any, row) => {
            const src = buildSrc(row);
            return src ? (
              <AntImage
                src={src}
                alt={row.prompt || row.image_id}
                width={96}
                height={96}
                style={{ objectFit: 'cover', borderRadius: 6 }}
                preview
              />
            ) : null;
          }}
        />
        <Table.Column<Order>
          dataIndex="user_email"
          title="User"
          width={240}
          render={(v: string | undefined, row: Order) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{v || row.user_id}</span>
              <Button size="small" type="text" onClick={() => openUserDetails(row.user_id)} title="View user">
                <ZoomIn size={16} />
              </Button>
            </div>
          )}
        />
        <Table.Column<Order>
          dataIndex="estimated_price_text"
          title="Estimated"
          render={(v?: string)=> formatEstimatedText(v)}
        />
        <Table.Column<Order>
          dataIndex="actual_price_cents"
          title="Actual"
          render={(v?: number)=> formatPriceCents(v)}
        />
        <Table.Column<Order>
          dataIndex="created_at"
          title="Created"
          width={220}
          render={(v: string) => (<AdminDate value={v} />)}
        />
        <Table.Column<Order>
          title="Actions"
          render={(_: any, row: Order) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
            </Space>
          )}
          width={80}
        />
      </Table>
      </AntImage.PreviewGroup>

      <Drawer title={record ? `Order ${record.id}` : 'Order'} open={open} onClose={()=>setOpen(false)} width={520} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item label="Notes" name="notes">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item label="Actual Price (USD)" name="actual_price_dollars">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Button onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer title={viewRecord ? `Image: ${viewRecord.id}` : 'Image'} open={viewOpen} onClose={() => setViewOpen(false)} width={510} destroyOnClose zIndex={token.zIndexPopupBase + 1000}>
        {detailsLoading || !viewRecord ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
            <Spin />
          </div>
        ) : (
          <ImageDetailsCard image={viewRecord as AdminImage} />
        )}
      </Drawer>

      <Drawer title={userDetails ? `User: ${userDetails.email}` : 'User'} open={userOpen} onClose={() => setUserOpen(false)} width={420} destroyOnClose>
        {userLoading || !userDetails ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
            <Spin />
          </div>
        ) : (
          <div style={{ display: 'grid', rowGap: 8 }}>
            <div><strong>Email:</strong> {userDetails.email}</div>
            <div><strong>Name:</strong> {[userDetails.first_name, userDetails.last_name].filter(Boolean).join(' ') || '—'}</div>
            <div><strong>Role:</strong> {userDetails.role_name || '—'}</div>
            <div><strong>Plan:</strong> {userDetails.subscription_plan || '—'}</div>
            <div><strong>Created:</strong> <AdminDate value={userDetails.created_at} /></div>
            <div><strong>Last Login:</strong> <AdminDate value={userDetails.last_login_at} /></div>
          </div>
        )}
      </Drawer>
    </List>
  );
}
