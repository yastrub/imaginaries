"use client";
import React from "react";
import { Switch, Tooltip } from "antd";
import { BulbOutlined } from "@ant-design/icons";

export const ThemeSwitch: React.FC<{ checked: boolean; onChange: (v: boolean)=>void }>=({checked,onChange})=>{
  return (
    <Tooltip title={checked ? "Dark" : "Light"}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <BulbOutlined />
        <Switch checked={checked} onChange={onChange} />
      </span>
    </Tooltip>
  );
};

