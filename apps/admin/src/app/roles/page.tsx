"use client";
import { List, useTable } from "@refinedev/antd";
import { Table, Tag, Space, Input, Button, Drawer, Form, Select, message, Descriptions, Popconfirm } from "antd";
import React from "react";
import { useUpdate, useCreate, useDelete } from "@refinedev/core";
import { EditOutlined, SearchOutlined, EyeOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import AdminDate from "../../components/AdminDate";
import { PERMISSIONS, PERMISSION_MAP } from "@/config/permissions";
import type { PermissionKey } from "@/config/permissions";

 type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions: PermissionKey[];
  created_at: string;
};

export default function RolesPage() {
  const [search, setSearch] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [editRecord, setEditRecord] = React.useState<Role | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewRecord, setViewRecord] = React.useState<Role | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const { tableProps, setFilters, tableQueryResult } = useTable<Role>({
    resource: "roles",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: create } = useCreate();
  const { mutateAsync: deleteOne } = useDelete();

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  const onEdit = (row: Role) => { setEditRecord(row); setEditOpen(true); };
  const onView = (row: Role) => { setViewRecord(row); setViewOpen(true); };

  const permissionOptions = React.useMemo(() => {
    const groups = new Map<string, { label: string; options: { label: string; value: PermissionKey }[] }>();
    for (const p of PERMISSIONS) {
      const cat = p.category || "Other";
      if (!groups.has(cat)) groups.set(cat, { label: cat, options: [] });
      groups.get(cat)!.options.push({ label: p.description, value: p.permission });
    }
    return Array.from(groups.values());
  }, []);

  const onSubmitEdit = async (values: any) => {
    if (!editRecord) return;
    try {
      await update({ resource: "roles", id: editRecord.id, values });
      message.success("Role updated");
      setEditOpen(false); setEditRecord(null);
      await tableQueryResult.refetch();
    } catch (e: any) {
      message.error(e?.message || "Update failed");
    }
  };

  const onSubmitCreate = async (values: any) => {
    try {
      await create({ resource: "roles", values });
      message.success("Role created");
      setCreateOpen(false);
      await tableQueryResult.refetch();
    } catch (e: any) {
      message.error(e?.message || "Create failed");
    }
  };

  const handleDelete = async (row: Role) => {
    try {
      await deleteOne({ resource: "roles", id: row.id });
      message.success("Role deleted");
      await tableQueryResult.refetch();
    } catch (e: any) {
      message.error(e?.message || "Delete failed");
    }
  };

  const isSystemRole = (id: number) => id === 1 || id === 2;

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Roles <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search roles..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
        <Button icon={<PlusOutlined />} onClick={()=>setCreateOpen(true)}>New</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column<Role> dataIndex="name" title="Name" sorter />
        <Table.Column<Role> dataIndex="description" title="Description" />
        <Table.Column<Role>
          title="Permissions"
          render={(_: any, row: Role) => (
            <Space size={[0, 8]} wrap>
              {(row.permissions || []).map((perm) => (
                <Tag key={perm} color="purple">{PERMISSION_MAP[perm]?.description || perm}</Tag>
              ))}
            </Space>
          )}
        />
        <Table.Column<Role> dataIndex="created_at" title="Created" sorter render={(v: string)=> (<AdminDate value={v} />)} />
        <Table.Column<Role>
          title="Actions"
          render={(_: any, row: Role) => (
            <Space>
              <Button icon={<EyeOutlined />} onClick={() => onView(row)}>View</Button>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
              <Popconfirm
                title={isSystemRole(row.id) ? "System roles cannot be deleted" : "Delete this role?"}
                okText="Delete"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
                disabled={isSystemRole(row.id)}
                onConfirm={() => handleDelete(row)}
              >
                <Button icon={<DeleteOutlined />} danger disabled={isSystemRole(row.id)}>Delete</Button>
              </Popconfirm>
            </Space>
          )}
        />
      </Table>

      <Drawer title={editRecord?.name || "Edit Role"} open={editOpen} onClose={()=>setEditOpen(false)} width={520} destroyOnClose>
        <Form layout="vertical" onFinish={onSubmitEdit} initialValues={{ name: editRecord?.name, description: editRecord?.description ?? undefined, permissions: editRecord?.permissions ?? [] }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="permissions" label="Permissions">
            <Select
              mode="multiple"
              placeholder="Select permissions"
              options={permissionOptions}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Space>
            <Button onClick={()=>setEditOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer title="New Role" open={createOpen} onClose={()=>setCreateOpen(false)} width={520} destroyOnClose>
        <Form layout="vertical" onFinish={onSubmitCreate} initialValues={{ permissions: [] }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="permissions" label="Permissions">
            <Select
              mode="multiple"
              placeholder="Select permissions"
              options={permissionOptions}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Space>
            <Button onClick={()=>setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Create</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer title={viewRecord ? `Role: ${viewRecord.name}` : "Role"} open={viewOpen} onClose={() => setViewOpen(false)} width={520} destroyOnClose>
        {viewRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Name">{viewRecord.name}</Descriptions.Item>
            <Descriptions.Item label="Description">{viewRecord.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Permissions">
              <Space size={[0, 8]} wrap>
                {(viewRecord.permissions || []).map((perm) => (
                  <Tag key={perm} color="purple">{PERMISSION_MAP[perm]?.description || perm}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Created"><AdminDate value={viewRecord.created_at} /></Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </List>
  );
}
