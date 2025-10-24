"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Drawer, Form, Switch, Tag, Typography, Select, InputNumber } from "antd";
import { useCreate, useUpdate } from "@refinedev/core";
import { PlusOutlined, EditOutlined, SearchOutlined } from "@ant-design/icons";

const { Text } = Typography;

type Terminal = {
  id: string;
  partner_id: string;
  partner_name?: string | null;
  name: string;
  mac_address?: string | null;
  last_seen_ip?: string | null;
  last_seen_at?: string | null;
  app_version?: string | null;
  os_version?: string | null;
  location_text?: string | null;
  is_active: boolean;
  status?: 'online' | 'offline';
  created_at: string;
  updated_at: string;
};

type PartnerOption = { value: string; label: string };

export default function TerminalsPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<Terminal | null>(null);
  const [form] = Form.useForm();
  const [partners, setPartners] = React.useState<PartnerOption[]>([]);

  const { tableProps, setFilters } = useTable<Terminal>({
    resource: "terminals",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const { mutateAsync: create } = useCreate();
  const { mutateAsync: update } = useUpdate();

  React.useEffect(() => {
    // Load partners for select options
    (async () => {
      try {
        const res = await fetch(`/api/admin/partners?page=1&limit=200`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const opts = (json.data || []).map((p: any) => ({ value: p.id as string, label: p.company_name as string }));
          setPartners(opts);
        }
      } catch {}
    })();
  }, []);

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  const onCreate = () => {
    setRecord(null);
    form.resetFields();
    setOpen(true);
    // Defer to ensure form instance is mounted before setting fields
    setTimeout(() => {
      form.setFieldsValue({ is_active: true });
    }, 0);
  };

  const onEdit = (row: Terminal) => {
    setRecord(row);
    setOpen(true);
    // Defer to ensure form instance is mounted before setting fields
    setTimeout(() => {
      form.setFieldsValue({
        partner_id: row.partner_id,
        name: row.name,
        mac_address: row.mac_address || "",
        location_text: row.location_text || "",
        app_version: row.app_version || "",
        os_version: row.os_version || "",
        last_seen_ip: row.last_seen_ip || "",
        is_active: row.is_active,
      });
    }, 0);
  };

  const onSubmit = async (values: any) => {
    const payload = {
      partner_id: values.partner_id,
      name: values.name,
      mac_address: values.mac_address || null,
      location_text: values.location_text || null,
      app_version: values.app_version || null,
      os_version: values.os_version || null,
      last_seen_ip: values.last_seen_ip || null,
      is_active: !!values.is_active,
    };
    if (record) {
      await update({ resource: 'terminals', id: record.id, values: payload });
    } else {
      await create({ resource: 'terminals', values: payload });
    }
    setOpen(false);
    setRecord(null);
    form.resetFields();
    // Refine v6: useCreate/useUpdate will invalidate the list query automatically.
  };

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Terminals <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search name, MAC or partner..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
        <Button icon={<PlusOutlined />} onClick={onCreate}>New Terminal</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column<Terminal> dataIndex="name" title="Name" sorter />
        <Table.Column<Terminal> dataIndex="partner_name" title="Partner" />
        <Table.Column<Terminal>
          dataIndex="status"
          title="Status"
          render={(v: string) => v === 'online' ? <Tag color="green">Online</Tag> : <Tag color="red">Offline</Tag>}
          width={110}
        />
        <Table.Column<Terminal> dataIndex="last_seen_at" title="Last Seen" />
        <Table.Column<Terminal> dataIndex="app_version" title="App" />
        <Table.Column<Terminal> dataIndex="os_version" title="OS" />
        <Table.Column<Terminal>
          dataIndex="is_active"
          title="Active"
          render={(v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          width={100}
        />
        <Table.Column<Terminal>
          title="Actions"
          render={(_: any, row: Terminal) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
            </Space>
          )}
          width={50}
        />
      </Table>

      <Drawer title={record ? `Edit: ${record.name}` : 'New Terminal'} open={open} onClose={()=>setOpen(false)} width={560} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="partner_id" label="Partner" rules={[{ required: true }]}> 
            <Select options={partners} showSearch optionFilterProp="label" placeholder="Select partner" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}> 
            <Input placeholder="e.g., Mall Kiosk #01" />
          </Form.Item>
          <Form.Item name="mac_address" label="MAC Address"> 
            <Input placeholder="AA:BB:CC:DD:EE:FF" />
          </Form.Item>
          <Form.Item name="location_text" label="Location"> 
            <Input placeholder="City, Place (optional)" />
          </Form.Item>
          <Form.Item name="app_version" label="App Version"> 
            <Input placeholder="e.g., 1.2.3" />
          </Form.Item>
          <Form.Item name="os_version" label="OS Version"> 
            <Input placeholder="e.g., Android 12" />
          </Form.Item>
          <Form.Item name="last_seen_ip" label="Last Seen IP"> 
            <Input placeholder="Optional override" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked"> 
            <Switch />
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
