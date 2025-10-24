"use client";
import { List, useTable } from "@refinedev/antd";
import { Table, Tag, Space, Input, Button, Drawer, Form, Select, Switch, message, Descriptions } from "antd";
import React from "react";
import { useUpdate, useList, useCreate } from "@refinedev/core";
import { EditOutlined, SearchOutlined, EyeOutlined, PlusOutlined } from "@ant-design/icons";
import AdminDate from "../../components/AdminDate";

type User = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  email_confirmed: boolean;
  subscription_plan: string;
  role_id: number;
  role_name: string | null;
  initial_ip?: string | null;
  last_ip?: string | null;
  last_user_agent?: string | null;
  created_at: string;
  last_login_at: string | null;
};

type Plan = {
  id: number;
  key: string;
  name: string;
};

export default function UsersList() {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [record, setRecord] = React.useState<User | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewRecord, setViewRecord] = React.useState<User | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [initialCountryCode, setInitialCountryCode] = React.useState<string>("");
  const [lastCountryCode, setLastCountryCode] = React.useState<string>("");
  const [uaInfo, setUaInfo] = React.useState<{ os: string; browser: string }>({ os: "", browser: "" });

  const { tableProps, setFilters } = useTable<User>({
    resource: "users",
    pagination: { pageSize: 20 },
    syncWithLocation: true,
  });

  const { mutateAsync: update } = useUpdate();
  const { mutateAsync: create } = useCreate();

  // Load plans for manual assignment selector
  const { result: plansResult, query: plansQuery } = useList<Plan>({
    resource: "plans",
    pagination: { pageSize: 100 },
  });
  const plansLoading = plansQuery.isLoading;
  const planOptions = React.useMemo(() => {
    const base = (plansResult?.data || []).map((p) => ({ value: p.key, label: p.name }));
    return [
      { value: 'auto', label: 'AUTO (derive from active subscription)' },
      ...base,
    ];
  }, [plansResult]);

  const onSearch = () => {
    setFilters([{ field: "q", operator: "contains", value: search }], "replace");
  };

  const onEdit = (row: User) => {
    setRecord(row); setOpen(true);
  };

  const parseUserAgent = (ua?: string | null): { os: string; browser: string } => {
    if (!ua) return { os: "", browser: "" };
    const lower = ua.toLowerCase();
    let os = "";
    // Detect iOS before macOS (iPhone UA includes "like Mac OS X")
    if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) os = "iOS";
    else if (lower.includes("android")) os = "Android";
    else if (lower.includes("windows")) os = "Windows";
    else if (lower.includes("mac os x")) os = "macOS";
    else if (lower.includes("linux")) os = "Linux";

    let browser = "";
    // iOS Chrome uses "CriOS", iOS Firefox uses "FxiOS", Edge may appear as EdgiOS
    if (lower.includes("crios/")) browser = "Chrome";
    else if (lower.includes("fxios/")) browser = "Firefox";
    else if (lower.includes("edgios/") || lower.includes("edg/")) browser = "Edge";
    else if (lower.includes("opr/")) browser = "Opera";
    else if (lower.includes("chrome/")) browser = "Chrome";
    else if (lower.includes("safari/") && lower.includes("version/")) browser = "Safari";

    return { os, browser };
  };

  const fetchCountryCode = async (ip?: string | null): Promise<string> => {
    if (!ip) { return ""; }
    try {
      // ipapi.co returns just the country code when hitting /country/
      const r = await fetch(`https://ipapi.co/${ip}/country/`);
      if (r.ok) {
        const text = (await r.text()).trim();
        return text || "";
      }
    } catch {}
    try {
      const r2 = await fetch(`https://ipwho.is/${ip}`);
      const j = await r2.json();
      return j?.country_code || "";
    } catch {
      return "";
    }
  };

  const onView = async (row: User) => {
    setViewRecord(row);
    setUaInfo(parseUserAgent(row.last_user_agent));
    setViewOpen(true);
    // Lookup country codes for both initial and last IPs
    setInitialCountryCode("");
    setLastCountryCode("");
    fetchCountryCode(row.initial_ip).then(setInitialCountryCode);
    fetchCountryCode(row.last_ip).then(setLastCountryCode);
  };

  const onSubmit = async (values: any) => {
    if (!record) return;
    try {
      await update({ resource: "users", id: record.id, values });
      message.success("User updated");
      setOpen(false); setRecord(null);
      // Refine v6: mutations invalidate the list query automatically.
    } catch (e:any) {
      message.error(e.message || 'Update failed');
    }
  };

  // Use centralized AdminDate component for all date displays

  return (
    <List title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Users <Tag color="blue">{(tableProps.pagination as any)?.total ?? ((tableProps.dataSource as any[])?.length ?? 0)}</Tag></span>} headerButtons={() => (
      <Space>
        <Input allowClear placeholder="Search email..." value={search} onChange={(e)=>setSearch(e.target.value)} onPressEnter={onSearch} prefix={<SearchOutlined />} />
        <Button type="primary" onClick={onSearch}>Search</Button>
        <Button icon={<PlusOutlined />} onClick={()=>setCreateOpen(true)}>New</Button>
      </Space>
    )}>
      <Table rowKey="id" {...tableProps}>
        <Table.Column dataIndex="email" title="Email" sorter />
        <Table.Column<User>
          dataIndex="role_name"
          title="Role"
          sorter
          render={(_: any, row: User) => {
            const name = row.role_name || 'unknown';
            const color = row.role_id === 1 ? 'magenta' : 'default';
            return <Tag color={color}>{name}</Tag>;
          }}
        />
        <Table.Column dataIndex="subscription_plan" title="Plan" sorter render={(v: string)=> <Tag color={v==='business'?'gold': v==='pro'?'purple':'default'}>{v}</Tag>} />
        <Table.Column dataIndex="email_confirmed" title="Confirmed" sorter render={(v: boolean) => (v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>)} />
        <Table.Column dataIndex="created_at" title="Created" sorter render={(v: string)=> (<AdminDate value={v} />)} />
        <Table.Column dataIndex="last_login_at" title="Last Login" sorter render={(v: string | null)=> (<AdminDate value={v} />)} />
        <Table.Column
          title="Actions"
          render={(_: any, row: User) => (
            <Space>
              <Button icon={<EyeOutlined />} onClick={() => onView(row)}>View</Button>
              <Button icon={<EditOutlined />} onClick={() => onEdit(row)}>Edit</Button>
            </Space>
          )}
        />
      </Table>

      <Drawer title={record?.email} open={open} onClose={()=>setOpen(false)} width={400} destroyOnClose>
        <Form layout="vertical" onFinish={onSubmit} initialValues={{ first_name: record?.first_name, last_name: record?.last_name, role_id: record?.role_id, email_confirmed: record?.email_confirmed, subscription_plan: record?.subscription_plan }}>
          <Form.Item name="first_name" label="First Name">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name">
            <Input />
          </Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
            <Select options={[{value:1,label:'superuser'},{value:2,label:'public'}]} />
          </Form.Item>
          <Form.Item name="subscription_plan" label="Subscription Plan">
            <Select
              placeholder="Select a plan"
              options={planOptions}
              loading={plansLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="email_confirmed" label="Email Confirmed" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Save</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer title="New User" open={createOpen} onClose={()=>setCreateOpen(false)} width={420} destroyOnClose>
        <Form layout="vertical" onFinish={async (values)=>{
          try {
            await create({ resource: "users", values });
            message.success("User created");
            setCreateOpen(false);
            // Refine v6: mutations invalidate the list query automatically.
          } catch (e:any) {
            message.error(e?.message || 'Create failed');
          }
        }} initialValues={{ role_id: 2, email_confirmed: true }}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email is required' }]}>
            <Input type="email" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'At least 6 characters' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="first_name" label="First Name">
            <Input />
          </Form.Item>
          <Form.Item name="last_name" label="Last Name">
            <Input />
          </Form.Item>
          <Form.Item name="role_id" label="Role" rules={[{ required: true }]}>
            <Select options={[{value:1,label:'superuser'},{value:2,label:'public'}]} />
          </Form.Item>
          <Form.Item name="subscription_plan" label="Subscription Plan">
            <Select
              placeholder="Select a plan"
              options={planOptions}
              loading={plansLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="email_confirmed" label="Email Confirmed" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button onClick={()=>setCreateOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit">Create</Button>
          </Space>
        </Form>
      </Drawer>

      <Drawer title={viewRecord ? `User: ${viewRecord.email}` : "User"} open={viewOpen} onClose={() => setViewOpen(false)} width={520} destroyOnClose>
        {viewRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Email">{viewRecord.email}</Descriptions.Item>
            <Descriptions.Item label="First Name">{viewRecord.first_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Last Name">{viewRecord.last_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Role">{viewRecord.role_name || 'unknown'}</Descriptions.Item>
            <Descriptions.Item label="Plan">{viewRecord.subscription_plan}</Descriptions.Item>
            <Descriptions.Item label="Created"><AdminDate value={viewRecord.created_at} /></Descriptions.Item>
            <Descriptions.Item label="Last Login"><AdminDate value={viewRecord.last_login_at} /></Descriptions.Item>
            <Descriptions.Item label="Initial IP">{viewRecord.initial_ip || '—'} {initialCountryCode ? `(${initialCountryCode})` : ''}</Descriptions.Item>
            <Descriptions.Item label="Last IP">{viewRecord.last_ip || '—'} {lastCountryCode ? `(${lastCountryCode})` : ''}</Descriptions.Item>
            <Descriptions.Item label="OS / Browser">{uaInfo.os || '—'} {uaInfo.browser ? ` / ${uaInfo.browser}` : ''}</Descriptions.Item>
            <Descriptions.Item label="User-Agent">{viewRecord.last_user_agent || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email Confirmed">{viewRecord.email_confirmed ? 'Yes' : 'No'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </List>
  );
}
