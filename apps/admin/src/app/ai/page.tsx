"use client";
import React from "react";
import { Tabs, Card, Space, Table, Tag, Form, Input, Select, Button, Switch, message, Typography, Divider } from "antd";
import JsonSmartEditor from "../../components/JsonSmartEditor";
import { CheckCircleTwoTone, SettingOutlined, PlusOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

const SCOPE_OPTIONS = [
  { value: "enhance", label: "Enhance" },
  { value: "sketch", label: "Sketch" },
  { value: "estimate", label: "Estimate" },
  { value: "system", label: "System" },
  { value: "other", label: "Other" },
];

const PURPOSE_OPTIONS = [
  { value: "image", label: "Image Generation" },
  { value: "sketch", label: "Sketch Description" },
  { value: "estimate", label: "Cost Estimation" },
];

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "replicate", label: "Replicate" },
  { value: "fal", label: "Fal.ai" },
];

export default function AISettingsPage() {
  const [prompts, setPrompts] = React.useState<any[]>([]);
  const [promptsLoading, setPromptsLoading] = React.useState(false);
  const [defaults, setDefaults] = React.useState<Record<string, any>>({});
  const [defaultsLoading, setDefaultsLoading] = React.useState(false);

  // Providers / Services state
  const [providers, setProviders] = React.useState<any[]>([]);
  const [providersLoading, setProvidersLoading] = React.useState(false);
  const [services, setServices] = React.useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = React.useState(false);

  // Smart JSON editor modal for service params
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorValue, setEditorValue] = React.useState<any>({});
  const [editorTitle, setEditorTitle] = React.useState<string>("");
  const editorRowRef = React.useRef<any | null>(null);

  const [promptForm] = Form.useForm();
  const [defaultsForm] = Form.useForm();

  const fetchPrompts = React.useCallback(async () => {
    setPromptsLoading(true);
    try {
      const res = await fetch("/api/admin/ai/prompts", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load prompts");
      setPrompts(json.data || []);
    } catch (e: any) {
      message.error(e?.message || "Failed to load prompts");
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  const fetchDefaults = React.useCallback(async () => {
    setDefaultsLoading(true);
    try {
      const res = await fetch("/api/admin/ai/defaults", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load defaults");
      const map: Record<string, any> = {};
      for (const row of json.data || []) map[row.purpose] = row;
      setDefaults(map);
      defaultsForm.setFieldsValue({
        image_provider_key: map.image?.provider_key,
        image_model_key: map.image?.model_key,
        sketch_provider_key: map.sketch?.provider_key,
        sketch_model_key: map.sketch?.model_key,
        estimate_provider_key: map.estimate?.provider_key,
        estimate_model_key: map.estimate?.model_key,
      });
    } catch (e: any) {
      message.error(e?.message || "Failed to load defaults");
    } finally {
      setDefaultsLoading(false);
    }
  }, [defaultsForm]);

  React.useEffect(() => {
    fetchPrompts();
    fetchDefaults();
  }, [fetchPrompts, fetchDefaults]);

  const fetchProviders = React.useCallback(async () => {
    setProvidersLoading(true);
    try {
      const res = await fetch("/api/admin/ai/providers", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load providers");
      setProviders(json.data || []);
    } catch (e:any) {
      message.error(e?.message || "Failed to load providers");
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  const fetchServices = React.useCallback(async () => {
    setServicesLoading(true);
    try {
      const res = await fetch("/api/admin/ai/services", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load services");
      setServices(json.data || []);
    } catch (e:any) {
      message.error(e?.message || "Failed to load services");
    } finally {
      setServicesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProviders();
    fetchServices();
  }, [fetchProviders, fetchServices]);

  const openParamsEditor = (row: any) => {
    editorRowRef.current = row;
    setEditorTitle(`Edit Params: ${row.provider_key}/${row.key}`);
    setEditorValue(row.params || {});
    setEditorOpen(true);
  };

  const saveParamsEditor = async (next: any) => {
    try {
      const row = editorRowRef.current;
      const payload = {
        provider_key: row.provider_key,
        key: row.key,
        api_url: row.api_url,
        model_key: row.model_key,
        params: next,
        enabled: row.enabled,
      };
      const res = await fetch("/api/admin/ai/services", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save params");
      message.success("Params updated");
      setEditorOpen(false);
      fetchServices();
    } catch (e:any) {
      message.error(e?.message || "Failed to save params");
    }
  };

  const onCreatePrompt = async (values: any) => {
    try {
      const payload = { scope: values.scope, key: values.key, content: values.content, is_active: !!values.is_active };
      const res = await fetch("/api/admin/ai/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create prompt");
      message.success("Prompt saved");
      promptForm.resetFields();
      fetchPrompts();
    } catch (e: any) {
      message.error(e?.message || "Failed to save prompt");
    }
  };

  const onSaveDefault = async (purpose: string, provider_key?: string, model_key?: string) => {
    try {
      if (!provider_key) throw new Error("Provider is required");
      const res = await fetch("/api/admin/ai/defaults", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ purpose, provider_key, model_key: model_key || null }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save default");
      message.success(`${purpose} default saved`);
      fetchDefaults();
    } catch (e: any) {
      message.error(e?.message || "Failed to save default");
    }
  };

  const promptColumns = [
    { title: "Scope", dataIndex: "scope", key: "scope", width: 120, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: "Key", dataIndex: "key", key: "key", width: 180 },
    { title: "Version", dataIndex: "version", key: "version", width: 100 },
    { title: "Active", dataIndex: "is_active", key: "is_active", width: 100, render: (v: boolean) => v ? <CheckCircleTwoTone twoToneColor="#52c41a" /> : <Tag>no</Tag> },
    { title: "Updated", dataIndex: "updated_at", key: "updated_at" },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 12 }}><SettingOutlined /> <span style={{ marginLeft: 8 }}>AI Control</span></Title>
      <Tabs
        defaultActiveKey="prompts"
        items={[
          {
            key: "prompts",
            label: "Prompts",
            children: (
              <Space direction="vertical" style={{ width: "100%" }} size="large">
                <Card title="Create / Version Prompt" size="small">
                  <Form form={promptForm} layout="vertical" onFinish={onCreatePrompt}>
                    <Space wrap style={{ width: "100%" }} size="middle">
                      <Form.Item name="scope" label="Scope" rules={[{ required: true }]}> 
                        <Select options={SCOPE_OPTIONS} style={{ minWidth: 180 }} />
                      </Form.Item>
                      <Form.Item name="key" label="Key" rules={[{ required: true }]}> 
                        <Input placeholder="e.g., openai_image_edit" style={{ minWidth: 220 }} />
                      </Form.Item>
                      <Form.Item name="is_active" label="Active" valuePropName="checked"> 
                        <Switch />
                      </Form.Item>
                    </Space>
                    <Form.Item name="content" label="Content" rules={[{ required: true }]}> 
                      <Input.TextArea placeholder="Prompt content..." autoSize={{ minRows: 5 }} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>Save Prompt</Button>
                  </Form>
                </Card>

                <Card title="Active and Versioned Prompts" size="small">
                  <Table rowKey={(r: any) => `${r.scope}:${r.key}:${r.version}`} loading={promptsLoading} columns={promptColumns as any} dataSource={prompts} size="small" pagination={{ pageSize: 10 }} />
                </Card>
              </Space>
            ),
          },
          {
            key: "defaults",
            label: "Defaults",
            children: (
              <Card title="Provider / Model Defaults" size="small">
                <Form form={defaultsForm} layout="vertical">
                  <Space direction="vertical" style={{ width: "100%" }} size="large">
                    {PURPOSE_OPTIONS.map((p) => (
                      <div key={p.value} style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr auto", gap: 12, alignItems: "end" }}>
                        <div>
                          <Text strong>{p.label}</Text>
                          <div><Text type="secondary">purpose: {p.value}</Text></div>
                        </div>
                        <Form.Item name={`${p.value}_provider_key`} label="Provider" initialValue={defaults[p.value]?.provider_key}>
                          <Select options={PROVIDER_OPTIONS} placeholder="Select provider" allowClear />
                        </Form.Item>
                        <Form.Item name={`${p.value}_model_key`} label="Model (optional)" initialValue={defaults[p.value]?.model_key}>
                          <Input placeholder="e.g., gpt-image-1" />
                        </Form.Item>
                        <div>
                          <Button onClick={() => onSaveDefault(
                            p.value,
                            defaultsForm.getFieldValue(`${p.value}_provider_key`),
                            defaultsForm.getFieldValue(`${p.value}_model_key`)
                          )} type="primary">Save</Button>
                        </div>
                      </div>
                    ))}
                  </Space>
                </Form>
                <Divider />
                <Text type="secondary">Provider/model options are hardcoded. Keys remain in environment variables.</Text>
              </Card>
            ),
          },
          {
            key: "providers",
            label: "Providers",
            children: (
              <Card title="Providers" size="small">
                <Table
                  rowKey={(r:any)=>r.id}
                  loading={providersLoading}
                  dataSource={providers}
                  size="small"
                  columns={[
                    { title: "Key", dataIndex: "key", key: "key", width: 160 },
                    { title: "Name", dataIndex: "name", key: "name" },
                    { title: "Enabled", dataIndex: "enabled", key: "enabled", width: 120, render: (v:boolean)=>(v ? <Tag color="green">yes</Tag> : <Tag>no</Tag>) },
                  ] as any}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            )
          },
          {
            key: "services",
            label: "Services",
            children: (
              <Card title="AI Services (per-provider API + params)" size="small">
                <Table
                  rowKey={(r:any)=>r.id}
                  loading={servicesLoading}
                  dataSource={services}
                  size="small"
                  columns={[
                    { title: "Provider", dataIndex: "provider_key", key: "provider_key", width: 140 },
                    { title: "Key", dataIndex: "key", key: "key", width: 180 },
                    { title: "Model", dataIndex: "model_key", key: "model_key", width: 180 },
                    { title: "Enabled", dataIndex: "enabled", key: "enabled", width: 110, render: (v:boolean)=>(v ? <Tag color="green">yes</Tag> : <Tag>no</Tag>) },
                    { title: "Actions", key: "actions", width: 160, render: (_:any, row:any)=> (
                      <Space>
                        <Button onClick={()=>openParamsEditor(row)}>Edit Params</Button>
                      </Space>
                    )},
                  ] as any}
                  pagination={{ pageSize: 10 }}
                />
                <JsonSmartEditor
                  open={editorOpen}
                  title={editorTitle}
                  value={editorValue}
                  onCancel={()=>setEditorOpen(false)}
                  onSave={saveParamsEditor}
                />
              </Card>
            )
          },
        ]}
      />
    </div>
  );
}
