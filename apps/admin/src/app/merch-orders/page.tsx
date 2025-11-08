"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Tag, Image as AntImage } from "antd";
import { SearchOutlined } from "@ant-design/icons";

export type MerchOrder = {
  id: string;
  status: string;
  merch_type: string;
  color?: string | null;
  size?: string | null;
  price_amount?: number | null;
  price_currency?: string | null;
  source_image_url: string;
  order_image_url: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

function formatPrice(amount?: number | null, currency?: string | null) {
  if (amount == null) return "—";
  const curr = (currency || 'AED').toUpperCase();
  try {
    // Try user locale; AED may not be supported; fallback to simple format
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr }).format(Number(amount));
  } catch {
    return `${Number(amount).toFixed(2)} ${curr}`;
  }
}

export default function MerchOrdersPage() {
  const [search, setSearch] = React.useState("");
  const { tableProps, setFilters } = useTable<MerchOrder>({
    resource: "merch_orders",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  return (
    <List title={<span>Merch Orders <Tag color="purple">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column<MerchOrder>
          title="Preview"
          dataIndex="order_image_url"
          width={120}
          render={(src: string) => src ? (
            <AntImage src={src} alt={src} width={96} height={96} style={{ objectFit: 'cover', borderRadius: 6 }} />
          ) : null}
        />
        <Table.Column<MerchOrder> dataIndex="merch_type" title="Type" width={120} />
        <Table.Column<MerchOrder> dataIndex="size" title="Size" width={80} />
        <Table.Column<MerchOrder> dataIndex="color" title="Color" width={100} />
        <Table.Column<MerchOrder>
          title="Price"
          render={(_: any, row: MerchOrder) => (
            <span>{formatPrice(row.price_amount, row.price_currency)}</span>
          )}
        />
        <Table.Column<MerchOrder> dataIndex="status" title="Status" width={120} render={(v: string)=> <Tag color={v==='submitted'?'green':'blue'}>{v||'draft'}</Tag>} />
        <Table.Column<MerchOrder> dataIndex="name" title="Name" />
        <Table.Column<MerchOrder> dataIndex="phone" title="Phone" />
        <Table.Column<MerchOrder> dataIndex="email" title="Email" />
        <Table.Column<MerchOrder> dataIndex="created_at" title="Created" />
      </Table>
    </List>
  );
}
