"use client";
import React from "react";
import { formatAdminDate } from "../utils/date";

export type AdminDateProps = {
  value?: string | null;
  emptyText?: string;
};

export function AdminDate({ value, emptyText = "—" }: AdminDateProps) {
  if (!value) return <>{emptyText}</>;
  return <>{formatAdminDate(value)}</>;
}

export default AdminDate;
