"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Drawer, Form, Select, Switch, Tag, message, Slider } from "antd";
import { useCreate, useUpdate, useList } from "@refinedev/core";
import { PlusOutlined, EditOutlined, SearchOutlined } from "@ant-design/icons";
import AdminDate from "../../components/AdminDate";

export type PromoCode = {
  id: string; // the code itself
  plan: string;
  is_valid: boolean;
  description?: string | null;
  discount?: number;
  created_at: string;
};

export type Plan = { id: number; key: string; name: string };

export default function PromoCodesPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<PromoCode | null>(null);
  const [form] = Form.useForm();

  const { tableProps, setFilters, tableQueryResult } = useTable<PromoCode>({
    resource: "promo_codes",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();

  const { data: plansList, isLoading: plansLoading } = useList<Plan>({ resource: "plans", pagination: { pageSize: 100, current: 1 } });
  const planOptions = React.useMemo(() => (plansList?.data || []).map(p => ({ value: p.key, label: p.name })), [plansList]);

  const onSearch = () => setFilters([{ field: "q", operator: "contains", value: search }], "replace");

  const onNew = () => { setRecord(null); form.resetFields(); setOpen(true); };
  const onEdit = (row: PromoCode) => { 
    setRecord(row); 
    form.setFieldsValue({
      id: row.id,
      plan: row.plan,
      is_valid: row.is_valid,
      discount_percent: Math.max(0, Math.min(100, Math.round(((row.discount || 0) * 100))))
    }); 
    setOpen(true); 
  };

  // Delete disabled/hidden per request

  const onSubmit = async (values: any) => {
    try {
      const payload = {
        id: values.id,
        plan: values.plan,
        is_valid: !!values.is_valid,
        // description hidden per request
        description: null,
        // Convert percent (1-100) slider to fraction (0-1)
        discount: Math.max(0, Math.min(1, ((Number(values.discount_percent) || 0) / 100)))
      };
      if (record) {
        await update({ resource: "promo_codes", id: record.id, values: payload });
        message.success("Promo code updated");
      } else {
        await create({ resource: "promo_codes", values: payload });
        message.success("Promo code created");
      }
      setOpen(false); setRecord(null); form.resetFields();
      await tableQueryResult.refetch();
    } catch (e: any) {
      message.error(e?.message || "Save failed");
    }
  };

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Promo Codes <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search code or description..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
        <Button icon={<PlusOutlined />} onClick={onNew}>New</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column dataIndex="id" title="Code" sorter />
        <Table.Column dataIndex="plan" title="Plan" sorter render={(v: string)=> <Tag color={v==='business'?'gold': v==='pro'?'purple':'default'}>{v}</Tag>} />
        <Table.Column dataIndex="is_valid" title="Valid" sorter render={(v: boolean)=> v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>} />
        <Table.Column dataIndex="discount" title="Discount" sorter render={(d: number)=> typeof d==='number' ? `${(d*100).toFixed(0)}%` : '—'} />
        <Table.Column
          dataIndex="created_at"
          title="Created"
          sorter
          render={(v: string) => (<AdminDate value={v} />)}
        />
        {/* Description hidden per request */}
        <Table.Column<PromoCode>
          title="Actions"
          render={(_: any, row: PromoCode) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
            </Space>
          )}
          width={80}
        />
      </Table>

      <Drawer title={record ? `Edit: ${record.id}` : 'New Promo Code'} open={open} onClose={()=>setOpen(false)} width={420} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ is_valid: true, discount_percent: 0 }}>
          {!record && (
            <Form.Item name="id" label="Code" rules={[{ required: true }]}> 
              <Input placeholder="e.g., LAUNCH50" />
            </Form.Item>
          )}
          <Form.Item name="plan" label="Plan" rules={[{ required: true }]}> 
            <Select options={planOptions} loading={plansLoading} placeholder="Select a plan" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="is_valid" label="Valid" valuePropName="checked">
            <Switch />
          </Form.Item>
          {/* Description hidden per request */}
          <Form.Item noStyle shouldUpdate>
            {() => {
              const v = form.getFieldValue('discount_percent') ?? 0;
              return (
                <Form.Item name="discount_percent" label={`Discount: ${v}%`}>
                  <Slider min={0} max={100} tooltip={{ formatter: (val) => `${val}%` }} />
                </Form.Item>
              );
            }}
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
