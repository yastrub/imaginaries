"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import AdminDate from "../../components/AdminDate";

export const dynamic = "force-dynamic";
export const revalidate = false;
export const fetchCache = 'force-no-store';

type Subscription = {
  id: string;
  user_id: string;
  user_email: string;
  plan: string;
  provider: string;
  provider_subscription_id?: string | null;
  status?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  is_annual?: boolean;
  original_price_cents?: number | null;
  promo_code?: string | null;
  discount?: number | null;
  cancel_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
};

export default function SubscriptionsPage() {
  const [search, setSearch] = React.useState("");
  const { tableProps, setFilters } = useTable<Subscription>({
    resource: "subscriptions",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  // Use AdminDate component for consistent date formatting

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Subscriptions <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search email or sub id..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column dataIndex="user_email" title="User" sorter />
        <Table.Column dataIndex="plan" title="Plan" sorter render={(v: string)=> <Tag color={v==='business'?'gold': v==='pro'?'purple':'default'}>{v}</Tag>} />
        <Table.Column dataIndex="provider" title="Provider" sorter />
        <Table.Column dataIndex="provider_subscription_id" title="Provider Sub ID" sorter />
        <Table.Column dataIndex="status" title="Status" sorter render={(v: string)=> v ? <Tag color={v==='active'?'green': v==='canceled'?'red':'default'}>{v}</Tag> : '—'} />
        <Table.Column dataIndex="is_annual" title="Interval" sorter render={(v?: boolean)=> v ? <Tag color="blue">Annual</Tag> : <Tag>Monthly</Tag>} />
        <Table.Column<Subscription> dataIndex="original_price_cents" title="Price" sorter render={(c?: number)=> typeof c==='number' ? `$${(c/100).toFixed(2)}` : '—'} />
        <Table.Column dataIndex="discount" title="Discount" sorter render={(d?: number)=> typeof d==='number' ? `-${(d*100).toFixed(0)}%` : '—'} />
        <Table.Column dataIndex="promo_code" title="Promo Code" />
        <Table.Column dataIndex="current_period_start" title="Period Start" sorter render={(v?: string|null)=> (<AdminDate value={v||undefined} />)} />
        <Table.Column dataIndex="current_period_end" title="Period End" sorter render={(v?: string|null)=> (<AdminDate value={v||undefined} />)} />
        <Table.Column dataIndex="created_at" title="Created" sorter render={(v?: string)=> (<AdminDate value={v} />)} />
      </Table>
    </List>
  );
}
