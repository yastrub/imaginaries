"use client";
import React from "react";
import { Card, Space, Table, Tag, Form, Input, Button, Switch, message, Select, Typography, Divider, Popconfirm } from "antd";
import JsonSmartEditor from "../../components/JsonSmartEditor";
import { PlusOutlined, AppstoreAddOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

type PresetSet = { id: string; name: string; slug: string; is_default: boolean; created_at: string; updated_at: string };
type Preset = { id: string; preset_set_id: string; key: string; label: string; payload: any; is_default: boolean; sort_order: number; created_at: string; updated_at: string };

export default function PresetsAdminPage() {
  const [sets, setSets] = React.useState<PresetSet[]>([]);
  const [setsLoading, setSetsLoading] = React.useState(false);
  const [selectedSetId, setSelectedSetId] = React.useState<string | undefined>(undefined);

  const [presets, setPresets] = React.useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = React.useState(false);

  const [createSetForm] = Form.useForm();
  const [editSetForm] = Form.useForm();
  const [createPresetForm] = Form.useForm();
  const [editPresetForm] = Form.useForm();

  // JSON editor modal state (used by create/edit preset forms)
  const [jsonEditorOpen, setJsonEditorOpen] = React.useState(false);
  const [jsonEditorTitle, setJsonEditorTitle] = React.useState("");
  const [jsonEditorValue, setJsonEditorValue] = React.useState<any>({});
  const jsonEditorTargetRef = React.useRef<'create' | 'edit'>('create');

  const fetchSets = React.useCallback(async () => {
    setSetsLoading(true);
    try {
      const res = await fetch('/api/admin/preset_sets', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load preset sets');
      setSets(json.data || []);
      if (!selectedSetId && (json.data || []).length) {
        const list = json.data as PresetSet[];
        const def = list.find((s) => s.is_default) || list[0];
        setSelectedSetId(def?.id);
      }
    } catch (e:any) {
      message.error(e?.message || 'Failed to load preset sets');
    } finally {
      setSetsLoading(false);
    }
  }, [selectedSetId]);

  const fetchPresets = React.useCallback(async (setId?: string) => {
    if (!setId) { setPresets([]); return; }
    setPresetsLoading(true);
    try {
      const res = await fetch(`/api/admin/presets?preset_set_id=${encodeURIComponent(setId)}`, { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load presets');
      setPresets(json.data || []);
    } catch (e:any) {
      message.error(e?.message || 'Failed to load presets');
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchSets(); }, [fetchSets]);
  React.useEffect(() => { fetchPresets(selectedSetId); }, [fetchPresets, selectedSetId]);

  const onCreateSet = async (values: any) => {
    try {
      const payload = { name: values.name, slug: values.slug, is_default: !!values.is_default };
      const res = await fetch('/api/admin/preset_sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create preset set');
      message.success('Preset set created');
      createSetForm.resetFields();
      fetchSets();
    } catch (e:any) {
      message.error(e?.message || 'Failed to create preset set');
    }
  };

  const onUpdateSet = async (id: string, values: any) => {
    try {
      const payload: any = {};
      if (values.name !== undefined) payload.name = values.name;
      if (values.slug !== undefined) payload.slug = values.slug;
      if (values.is_default !== undefined) payload.is_default = !!values.is_default;
      const res = await fetch(`/api/admin/preset_sets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update preset set');
      message.success('Preset set updated');
      fetchSets();
    } catch (e:any) {
      message.error(e?.message || 'Failed to update preset set');
    }
  };

  const onDeleteSet = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/preset_sets/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to delete preset set');
      message.success('Preset set deleted');
      if (selectedSetId === id) setSelectedSetId(undefined);
      fetchSets();
    } catch (e:any) {
      message.error(e?.message || 'Failed to delete preset set');
    }
  };

  const onCreatePreset = async (values: any) => {
    if (!selectedSetId) return;
    try {
      const payload = { preset_set_id: selectedSetId, key: values.key, label: values.label, payload: values.payload ? JSON.parse(values.payload) : {}, is_default: !!values.is_default, sort_order: values.sort_order ?? 0 };
      const res = await fetch('/api/admin/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create preset');
      message.success('Preset created');
      createPresetForm.resetFields();
      fetchPresets(selectedSetId);
    } catch (e:any) {
      message.error(e?.message || 'Failed to create preset');
    }
  };

  const onUpdatePreset = async (id: string, values: any) => {
    try {
      const payload: any = {};
      if (values.key !== undefined) payload.key = values.key;
      if (values.label !== undefined) payload.label = values.label;
      if (values.payload !== undefined) payload.payload = values.payload ? JSON.parse(values.payload) : {};
      if (values.is_default !== undefined) payload.is_default = !!values.is_default;
      if (values.sort_order !== undefined) payload.sort_order = values.sort_order;
      const res = await fetch(`/api/admin/presets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update preset');
      message.success('Preset updated');
      fetchPresets(selectedSetId);
    } catch (e:any) {
      message.error(e?.message || 'Failed to update preset');
    }
  };

  const onDeletePreset = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/presets/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to delete preset');
      message.success('Preset deleted');
      fetchPresets(selectedSetId);
    } catch (e:any) {
      message.error(e?.message || 'Failed to delete preset');
    }
  };

  const presetColumns = [
    { title: 'Key', dataIndex: 'key', key: 'key', width: 160 },
    { title: 'Label', dataIndex: 'label', key: 'label', width: 200 },
    { title: 'Default', dataIndex: 'is_default', key: 'is_default', width: 100, render: (v: boolean) => v ? <Tag color="green">yes</Tag> : <Tag>no</Tag> },
    { title: 'Order', dataIndex: 'sort_order', key: 'sort_order', width: 90 },
    { title: 'Actions', key: 'actions', width: 220, render: (_: any, row: Preset) => (
      <Space>
        <Popconfirm title="Delete preset?" onConfirm={() => onDeletePreset(row.id)}>
          <Button danger>Delete</Button>
        </Popconfirm>
        <Button onClick={() => {
          editPresetForm.setFieldsValue({ key: row.key, label: row.label, payload: JSON.stringify(row.payload, null, 2), is_default: row.is_default, sort_order: row.sort_order });
          (editPresetForm as any).__rowId = row.id;
        }}>Edit</Button>
      </Space>
    )},
  ];

  const setColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: 'Default', dataIndex: 'is_default', key: 'is_default', render: (v: boolean) => v ? <Tag color="green">yes</Tag> : <Tag>no</Tag> },
    { title: 'Actions', key: 'actions', width: 260, render: (_: any, row: PresetSet) => (
      <Space>
        <Button onClick={() => setSelectedSetId(row.id)}>Open</Button>
        <Popconfirm title="Delete preset set?" onConfirm={() => onDeleteSet(row.id)}>
          <Button danger>Delete</Button>
        </Popconfirm>
        <Button onClick={() => { editSetForm.setFieldsValue({ name: row.name, slug: row.slug, is_default: row.is_default }); (editSetForm as any).__rowId = row.id; }}>Edit</Button>
      </Space>
    )},
  ];

  const selectedSet = sets.find((s) => s.id === selectedSetId);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 12 }}><AppstoreAddOutlined /> <span style={{ marginLeft: 8 }}>Presets</span></Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="Preset Sets" size="small">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Form form={createSetForm} layout="inline" onFinish={onCreateSet}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input placeholder="Default" />
              </Form.Item>
              <Form.Item name="slug" label="Slug" rules={[{ required: true }]}>
                <Input placeholder="default" />
              </Form.Item>
              <Form.Item name="is_default" label="Default" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Button type="primary" icon={<PlusOutlined />} htmlType="submit">Create</Button>
            </Form>

            <Table rowKey="id" loading={setsLoading} dataSource={sets} columns={setColumns as any} pagination={{ pageSize: 8 }} />

            <Card title="Edit Preset Set" size="small">
              <Form form={editSetForm} layout="inline" onFinish={(values) => onUpdateSet((editSetForm as any).__rowId, values)}>
                <Form.Item name="name" label="Name">
                  <Input />
                </Form.Item>
                <Form.Item name="slug" label="Slug">
                  <Input />
                </Form.Item>
                <Form.Item name="is_default" label="Default" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Button type="primary" htmlType="submit">Save</Button>
              </Form>
            </Card>
          </Space>
        </Card>

        <Card title={<div>Presets {selectedSet ? <Text type="secondary">in set: {selectedSet.name}</Text> : null}</div>} size="small">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Text strong>Select Set:</Text>
              <Select
                style={{ minWidth: 240 }}
                options={sets.map((s) => ({ value: s.id, label: `${s.name}${s.is_default ? ' (default)' : ''}` }))}
                value={selectedSetId}
                onChange={setSelectedSetId}
                placeholder="Choose preset set"
              />
            </div>

            <Form form={createPresetForm} layout="vertical" onFinish={onCreatePreset}>
              <Space wrap style={{ width: '100%' }} size="large">
                <Form.Item name="key" label="Key" rules={[{ required: true }]}> 
                  <Input placeholder="classic" style={{ minWidth: 220 }} />
                </Form.Item>
                <Form.Item name="label" label="Label" rules={[{ required: true }]}> 
                  <Input placeholder="Classic Style" style={{ minWidth: 240 }} />
                </Form.Item>
                <Form.Item name="sort_order" label="Order"> 
                  <Input type="number" placeholder="0" style={{ width: 120 }} />
                </Form.Item>
                <Form.Item name="is_default" label="Default" valuePropName="checked"> 
                  <Switch />
                </Form.Item>
                <Form.Item name="payload" label="Payload (JSON)" style={{ minWidth: 480, flex: 1 }}> 
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Input.TextArea placeholder='{"style":"classic"}' autoSize={{ minRows: 4 }} />
                    <Button onClick={() => {
                      jsonEditorTargetRef.current = 'create';
                      setJsonEditorTitle('Edit Payload (Create Preset)');
                      const raw = createPresetForm.getFieldValue('payload');
                      try { setJsonEditorValue(raw ? JSON.parse(raw) : {}); } catch { setJsonEditorValue({}); }
                      setJsonEditorOpen(true);
                    }}>Smart JSON Editor</Button>
                  </Space>
                </Form.Item>
              </Space>
              <Button type="primary" icon={<PlusOutlined />} htmlType="submit" disabled={!selectedSetId}>Create Preset</Button>
            </Form>

            <Table rowKey="id" loading={presetsLoading} dataSource={presets} columns={presetColumns as any} pagination={{ pageSize: 10 }} />

            <Card title="Edit Preset" size="small">
              <Form form={editPresetForm} layout="vertical" onFinish={(values) => onUpdatePreset((editPresetForm as any).__rowId, values)}>
                <Space wrap style={{ width: '100%' }} size="large">
                  <Form.Item name="key" label="Key"> 
                    <Input style={{ minWidth: 220 }} />
                  </Form.Item>
                  <Form.Item name="label" label="Label"> 
                    <Input style={{ minWidth: 240 }} />
                  </Form.Item>
                  <Form.Item name="sort_order" label="Order"> 
                    <Input type="number" placeholder="0" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item name="is_default" label="Default" valuePropName="checked"> 
                    <Switch />
                  </Form.Item>
                  <Form.Item name="payload" label="Payload (JSON)" style={{ minWidth: 480, flex: 1 }}> 
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Input.TextArea autoSize={{ minRows: 4 }} />
                      <Button onClick={() => {
                        jsonEditorTargetRef.current = 'edit';
                        setJsonEditorTitle('Edit Payload (Edit Preset)');
                        const raw = editPresetForm.getFieldValue('payload');
                        try { setJsonEditorValue(raw ? JSON.parse(raw) : {}); } catch { setJsonEditorValue({}); }
                        setJsonEditorOpen(true);
                      }}>Smart JSON Editor</Button>
                    </Space>
                  </Form.Item>
                </Space>
                <Button type="primary" htmlType="submit">Save Preset</Button>
              </Form>
            </Card>
            <JsonSmartEditor
              open={jsonEditorOpen}
              title={jsonEditorTitle}
              value={jsonEditorValue}
              onCancel={() => setJsonEditorOpen(false)}
              onSave={(next) => {
                const pretty = JSON.stringify(next, null, 2);
                if (jsonEditorTargetRef.current === 'create') {
                  createPresetForm.setFieldsValue({ payload: pretty });
                } else {
                  editPresetForm.setFieldsValue({ payload: pretty });
                }
                setJsonEditorOpen(false);
              }}
            />
          </Space>
        </Card>
      </Space>
    </div>
  );
}
