"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Drawer, Form, InputNumber, Switch, Tag, Typography, Select } from "antd";
import { useCreate, useUpdate } from "@refinedev/core";
import { PlusOutlined, EditOutlined, SearchOutlined } from "@ant-design/icons";

export const dynamic = "force-dynamic";
export const revalidate = false;
export const fetchCache = 'force-no-store';

const { Text } = Typography;

export type Plan = {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  max_generations_per_day: number;
  show_watermark: boolean;
  allow_private_images: boolean;
  price_cents: number;
  annual_price_cents: number;
  currency: string;
  is_active: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function formatPrice(cents: number, currency: string) {
  const amount = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `$${amount.toFixed(2)} ${currency || 'USD'}`;
  }
}

export default function PlansPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<Plan | null>(null);
  const [form] = Form.useForm();

  const { tableProps, setFilters, tableQueryResult } = useTable<Plan>({
    resource: "plans",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  const onCreate = () => {
    setRecord(null);
    form.resetFields();
    // defaults
    form.setFieldsValue({
      currency: 'USD',
      max_generations_per_day: 0,
      show_watermark: true,
      allow_private_images: false,
      price_dollars: 0,
      annual_price_dollars: 0,
      is_active: true,
      is_public: true,
      sort_order: 0,
    });
    setOpen(true);
  };

  const onEdit = (row: Plan) => {
    setRecord(row);
    form.setFieldsValue({
      key: row.key,
      name: row.name,
      description: row.description || '',
      max_generations_per_day: row.max_generations_per_day,
      show_watermark: row.show_watermark,
      allow_private_images: row.allow_private_images,
      price_dollars: (row.price_cents || 0) / 100,
      annual_price_dollars: (row.annual_price_cents || 0) / 100,
      currency: row.currency || 'USD',
      is_active: row.is_active,
      is_public: row.is_public,
      sort_order: row.sort_order,
    });
    setOpen(true);
  };

  const onSubmit = async (values: any) => {
    const payload = {
      key: values.key,
      name: values.name,
      description: values.description || null,
      max_generations_per_day: Number(values.max_generations_per_day) || 0,
      show_watermark: !!values.show_watermark,
      allow_private_images: !!values.allow_private_images,
      price_cents: Math.round((Number(values.price_dollars) || 0) * 100),
      annual_price_cents: Math.round((Number(values.annual_price_dollars) || 0) * 100),
      currency: values.currency || 'USD',
      is_active: !!values.is_active,
      is_public: !!values.is_public,
      sort_order: Number(values.sort_order) || 0,
    };
    if (record) {
      await update({ resource: 'plans', id: record.id, values: payload });
    } else {
      await create({ resource: 'plans', values: payload });
    }
    setOpen(false);
    setRecord(null);
    form.resetFields();
    await tableQueryResult.refetch();
  };

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Plans <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search key or name..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
        <Button icon={<PlusOutlined />} onClick={onCreate}>New Plan</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column<Plan> dataIndex="key" title="Key" sorter />
        {false && <Table.Column<Plan> dataIndex="name" title="Name" />}
        <Table.Column<Plan>
          dataIndex="price_cents"
          title="Monthly Price"
          sorter
          render={(cents: number, row: Plan) => <Text>{formatPrice(cents, row.currency)}</Text>}
        />
        <Table.Column<Plan> dataIndex="max_generations_per_day" title="Max/Day" width={110} sorter />
        <Table.Column<Plan>
          dataIndex="show_watermark"
          title="Watermark"
          sorter
          render={(v: boolean) => v ? <Tag color="gold">Yes</Tag> : <Tag color="default">No</Tag>}
          width={110}
        />
        <Table.Column<Plan>
          dataIndex="allow_private_images"
          title="Private Images"
          sorter
          render={(v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          width={200}
        />
        <Table.Column<Plan>
          dataIndex="is_active"
          title="Active"
          sorter
          render={(v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          width={100}
        />
        <Table.Column<Plan>
          dataIndex="is_public"
          title="Public"
          sorter
          render={(v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          width={100}
        />
        {/* Order hidden per request */}
        <Table.Column<Plan>
          title="Actions"
          render={(_: any, row: Plan) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
            </Space>
          )}
          width={50}
        />
      </Table>

      <Drawer title={record ? `Edit: ${record.name}` : 'New Plan'} open={open} onClose={()=>setOpen(false)} width={520} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input placeholder="e.g., free, pro, business" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
            <Select options={[{value:'USD',label:'USD'}]} />
          </Form.Item>
          <Form.Item name="price_dollars" label="Monthly Price (USD)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="annual_price_dollars" label="Annual Price (USD)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_generations_per_day" label="Max Generations / Day">
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="show_watermark" label="Show Watermark" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allow_private_images" label="Allow Private Images" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_public" label="Public" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sort_order" label="Sort Order">
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
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
