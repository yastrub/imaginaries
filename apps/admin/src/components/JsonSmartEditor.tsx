"use client";
import React from "react";
import dynamic from "next/dynamic";
import { Modal, Tabs, Form, Input, InputNumber, Switch, Button, Space, Card, Typography, Divider, message } from "antd";

// Lazy-load CodeMirror on client only
const CodeMirror = dynamic<any>(() => import("@uiw/react-codemirror").then(m => m.default as any), { ssr: false });
// Lazy-load JSON language and theme
let jsonLang: any = null;
let oneDark: any = null;
if (typeof window !== 'undefined') {
  Promise.all([
    import("@codemirror/lang-json").then(m => { jsonLang = m.json; }),
    import("@codemirror/theme-one-dark").then(m => { oneDark = m.oneDark; })
  ]).catch(()=>{});
}

const { Text } = Typography;

function isPlainObject(v: any) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function clone(v: any) {
  return JSON.parse(JSON.stringify(v));
}

type JsonSmartEditorProps = {
  open: boolean;
  title?: string;
  value: any;
  onCancel: () => void;
  onSave: (next: any) => void;
};

export default function JsonSmartEditor({ open, title, value, onCancel, onSave }: JsonSmartEditorProps) {
  const [mode, setMode] = React.useState<'form' | 'json'>('form');
  const [form] = Form.useForm();
  const [jsonText, setJsonText] = React.useState('');
  const [working, setWorking] = React.useState<any>(clone(value ?? {}));

  React.useEffect(() => {
    setWorking(clone(value ?? {}));
  }, [value]);

  React.useEffect(() => {
    setJsonText(JSON.stringify(working ?? {}, null, 2));
    form.setFieldsValue({ __root: working });
  }, [working, form]);

  const handlePretty = () => {
    try {
      const obj = mode === 'json' ? JSON.parse(jsonText) : working;
      setJsonText(JSON.stringify(obj, null, 2));
      message.success('Formatted');
    } catch (e: any) {
      message.error(e?.message || 'Invalid JSON');
    }
  };

  const handleValidate = () => {
    try {
      const obj = mode === 'json' ? JSON.parse(jsonText) : working;
      if (typeof obj === 'undefined') throw new Error('Empty value');
      message.success('JSON is valid');
    } catch (e: any) {
      message.error(e?.message || 'Invalid JSON');
    }
  };

  const handleReset = () => {
    setWorking(clone(value ?? {}));
  };

  const save = () => {
    try {
      const next = mode === 'json' ? JSON.parse(jsonText) : working;
      onSave(next);
    } catch (e: any) {
      message.error(e?.message || 'Invalid JSON');
    }
  };

  const setAtPath = (path: (string|number)[], nextVal: any) => {
    const draft = clone(working);
    let cur: any = draft;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      cur = cur[k as any];
    }
    cur[path[path.length - 1] as any] = nextVal;
    setWorking(draft);
  };

  const removeAtPath = (path: (string|number)[]) => {
    const draft = clone(working);
    let cur: any = draft;
    for (let i = 0; i < path.length - 1; i++) {
      cur = cur[path[i] as any];
    }
    const last = path[path.length - 1];
    if (Array.isArray(cur)) cur.splice(last as number, 1);
    else if (isPlainObject(cur)) delete cur[last as string];
    setWorking(draft);
  };

  const addToArray = (path: (string|number)[], type: 'string'|'number'|'boolean'|'object') => {
    const draft = clone(working);
    let cur: any = draft;
    for (let i = 0; i < path.length; i++) {
      cur = cur[path[i] as any];
    }
    if (!Array.isArray(cur)) return;
    const val = type === 'string' ? '' : type === 'number' ? 0 : type === 'boolean' ? false : {};
    cur.push(val);
    setWorking(draft);
  };

  const addKeyToObject = (path: (string|number)[]) => {
    const draft = clone(working);
    let cur: any = draft;
    for (let i = 0; i < path.length; i++) cur = cur[path[i] as any];
    if (!isPlainObject(cur)) return;
    let base = 'key'; let idx = 1;
    while (Object.prototype.hasOwnProperty.call(cur, `${base}${idx}`)) idx++;
    cur[`${base}${idx}`] = '';
    setWorking(draft);
  };

  const renderValue = (val: any, path: (string|number)[] = []) => {
    if (typeof val === 'string') {
      return <Input value={val} onChange={(e)=>setAtPath(path, e.target.value)} />;
    }
    if (typeof val === 'number') {
      return <InputNumber style={{ width: '100%' }} value={val} onChange={(v)=>setAtPath(path, typeof v === 'number' ? v : 0)} />;
    }
    if (typeof val === 'boolean') {
      return <Switch checked={val} onChange={(v)=>setAtPath(path, v)} />;
    }
    if (Array.isArray(val)) {
      return (
        <Card size="small" style={{ background: 'transparent' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {val.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                {renderValue(item, [...path, idx])}
                <Button danger onClick={()=>removeAtPath([...path, idx])}>Remove</Button>
              </div>
            ))}
            <Space wrap>
              <Text type="secondary">Add item:</Text>
              <Button onClick={()=>addToArray(path, 'string')}>String</Button>
              <Button onClick={()=>addToArray(path, 'number')}>Number</Button>
              <Button onClick={()=>addToArray(path, 'boolean')}>Boolean</Button>
              <Button onClick={()=>addToArray(path, 'object')}>Object</Button>
            </Space>
          </Space>
        </Card>
      );
    }
    if (isPlainObject(val)) {
      const entries = Object.entries(val as Record<string, any>);
      return (
        <Card size="small" style={{ background: 'transparent' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {entries.map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 8, alignItems: 'center' }}>
                <Input value={k} disabled />
                {renderValue(v, [...path, k])}
                <Button danger onClick={()=>removeAtPath([...path, k])}>Remove</Button>
              </div>
            ))}
            <Button onClick={()=>addKeyToObject(path)}>Add key</Button>
          </Space>
        </Card>
      );
    }
    return <Input disabled placeholder="null/undefined not editable" />;
  };

  return (
    <Modal
      open={open}
      title={title || 'Edit JSON'}
      onCancel={onCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Tabs
        activeKey={mode}
        onChange={(k)=>setMode(k as any)}
        items={[
          {
            key: 'form',
            label: 'Smart Form',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Text type="secondary">Auto-generated controls based on JSON shape. Edit values safely.</Text>
                {renderValue(working, [])}
                <Divider />
                <Space>
                  <Button onClick={handlePretty}>Pretty Print</Button>
                  <Button onClick={handleValidate}>Validate</Button>
                  <Button onClick={handleReset}>Reset</Button>
                  <Button type="primary" onClick={save}>Save</Button>
                </Space>
              </Space>
            )
          },
          {
            key: 'json',
            label: 'Raw JSON',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Text type="secondary">Edit raw JSON with syntax highlighting and validation.</Text>
                {typeof window !== 'undefined' ? (
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {/* @ts-ignore CodeMirror is dynamically loaded */}
                    <CodeMirror
                      value={jsonText}
                      height="360px"
                      theme={oneDark || 'dark'}
                      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
                      extensions={jsonLang ? [jsonLang()] : []}
                      onChange={(v: string) => setJsonText(v)}
                    />
                  </div>
                ) : (
                  <Input.TextArea
                    value={jsonText}
                    onChange={(e)=>setJsonText(e.target.value)}
                    autoSize={{ minRows: 16 }}
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                  />
                )}
                <Divider />
                <Space>
                  <Button onClick={handlePretty}>Pretty Print</Button>
                  <Button onClick={handleValidate}>Validate</Button>
                  <Button onClick={handleReset}>Reset</Button>
                  <Button type="primary" onClick={save}>Save</Button>
                </Space>
              </Space>
            )
          }
        ]}
      />
    </Modal>
  );
}
