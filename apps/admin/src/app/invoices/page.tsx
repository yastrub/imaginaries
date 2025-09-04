"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import AdminDate from "../../components/AdminDate";

type Invoice = {
  id: string;
  user_id: string;
  user_email: string;
  subscription_id?: string | null;
  provider: string;
  provider_invoice_id?: string | null;
  amount_total: number;
  currency: string;
  status?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  created_at: string;
};

export default function InvoicesPage() {
  const [search, setSearch] = React.useState("");
  const { tableProps, setFilters } = useTable<Invoice>({
    resource: "invoices",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const onSearch = () => setFilters([{ field: "q", operator: "contains", value: search }], "replace");

  const money = (amt: number, cur: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency: (cur || 'USD').toUpperCase() }).format((amt || 0) / 100);

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Invoices <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search email or invoice id..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column dataIndex="user_email" title="User" sorter />
        <Table.Column<any>
          dataIndex="amount_total"
          title="Amount"
          sorter
          render={(_: any, row: Invoice) => money(row.amount_total, row.currency)}
        />
        <Table.Column dataIndex="status" title="Status" sorter render={(v: string)=> v ? <Tag color={v==='paid'?'green': v==='open'?'blue': v==='uncollectible'?'red':'default'}>{v}</Tag> : '—'} />
        <Table.Column dataIndex="provider" title="Provider" sorter />
        <Table.Column dataIndex="provider_invoice_id" title="Provider Invoice ID" sorter />
        <Table.Column dataIndex="period_start" title="Period Start" sorter render={(v?: string | null)=> (<AdminDate value={v||undefined} />)} />
        <Table.Column dataIndex="period_end" title="Period End" sorter render={(v?: string | null)=> (<AdminDate value={v||undefined} />)} />
        <Table.Column
          title="Links"
          render={(_: any, row: Invoice) => (
            <Space>
              {row.hosted_invoice_url ? <a href={row.hosted_invoice_url} target="_blank" rel="noreferrer">View</a> : null}
              {row.invoice_pdf ? <a href={row.invoice_pdf} target="_blank" rel="noreferrer">PDF</a> : null}
            </Space>
          )}
        />
        <Table.Column dataIndex="created_at" title="Created" sorter render={(v?: string)=> (<AdminDate value={v} />)} />
      </Table>
    </List>
  );
}
