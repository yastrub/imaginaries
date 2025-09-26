"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Drawer, Form, InputNumber, Tag } from "antd";
import { useUpdate } from "@refinedev/core";
import { EditOutlined, SearchOutlined } from "@ant-design/icons";

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

export default function OrdersPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<Order | null>(null);
  const [form] = Form.useForm();

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

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Orders <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search user/image..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column<Order> dataIndex="id" title="#" width={70} />
        <Table.Column<Order> dataIndex="user_email" title="User" render={(v: string, row: Order)=> v || row.user_id} />
        <Table.Column<Order> dataIndex="image_id" title="Image" />
        <Table.Column<Order> dataIndex="estimated_price_text" title="Estimated" render={(v?: string)=> v ? `${v} USD` : '—'} />
        <Table.Column<Order> dataIndex="actual_price_cents" title="Actual" render={(v?: number)=> formatPriceCents(v)} />
        <Table.Column<Order> dataIndex="created_at" title="Created" />
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
    </List>
  );
}
