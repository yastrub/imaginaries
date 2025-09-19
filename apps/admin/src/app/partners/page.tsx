"use client";
import React from "react";
import { List, useTable } from "@refinedev/antd";
import { Table, Space, Input, Button, Drawer, Form, Switch, Tag, Typography } from "antd";
import { useCreate, useUpdate } from "@refinedev/core";
import { PlusOutlined, EditOutlined, SearchOutlined } from "@ant-design/icons";

const { Text } = Typography;

type Partner = {
  id: string;
  company_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export default function PartnersPage() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<Partner | null>(null);
  const [form] = Form.useForm();

  const { tableProps, setFilters } = useTable<Partner>({
    resource: "partners",
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
    setOpen(true);
    // Defer to ensure form instance is mounted before setting fields
    setTimeout(() => {
      form.setFieldsValue({ is_active: true });
    }, 0);
  };

  const onEdit = (row: Partner) => {
    setRecord(row);
    setOpen(true);
    // Defer to ensure form instance is mounted before setting fields
    setTimeout(() => {
      form.setFieldsValue({
        company_name: row.company_name,
        contact_name: row.contact_name || "",
        email: row.email || "",
        phone: row.phone || "",
        is_active: row.is_active,
      });
    }, 0);
  };

  const onSubmit = async (values: any) => {
    const payload = {
      company_name: values.company_name,
      contact_name: values.contact_name || null,
      email: values.email || null,
      phone: values.phone || null,
      is_active: !!values.is_active,
    };
    if (record) {
      await update({ resource: 'partners', id: record.id, values: payload });
    } else {
      await create({ resource: 'partners', values: payload });
    }
    setOpen(false);
    setRecord(null);
    form.resetFields();
    // Refine v6: useCreate/useUpdate invalidate the list query by default.
    // If manual refresh is needed, we can trigger it by changing filters or pagination.
  };

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Partners <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search company, contact or email..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
        <Button icon={<PlusOutlined />} onClick={onCreate}>New Partner</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column<Partner> dataIndex="company_name" title="Company" sorter />
        <Table.Column<Partner> dataIndex="contact_name" title="Contact" />
        <Table.Column<Partner> dataIndex="email" title="Email" />
        <Table.Column<Partner> dataIndex="phone" title="Phone" />
        <Table.Column<Partner>
          dataIndex="is_active"
          title="Active"
          sorter
          render={(v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          width={100}
        />
        <Table.Column<Partner>
          title="Actions"
          render={(_: any, row: Partner) => (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
            </Space>
          )}
          width={50}
        />
      </Table>

      <Drawer title={record ? `Edit: ${record.company_name}` : 'New Partner'} open={open} onClose={()=>setOpen(false)} width={520} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSubmit}>
          <Form.Item name="company_name" label="Company" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>
          <Form.Item name="contact_name" label="Contact Name"> 
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email"> 
            <Input type="email" />
          </Form.Item>
          <Form.Item name="phone" label="Phone"> 
            <Input />
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
