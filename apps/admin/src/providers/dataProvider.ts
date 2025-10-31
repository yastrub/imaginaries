import type { BaseRecord, CrudFilters, CrudSorting, HttpError, DataProvider } from "@refinedev/core";

function buildQuery(params: { filters?: CrudFilters; pagination?: { current?: number; pageSize?: number } | undefined; sorters?: CrudSorting }) {
  const search = new URLSearchParams();
  const { pagination, filters, sorters } = params;
  // Determine page & limit from refine pagination only
  const current = pagination?.current ?? 1;
  const pageSize = pagination?.pageSize ?? 20;
  search.set("page", String(current));
  search.set("limit", String(pageSize));
  if (filters) {
    const q = filters.find((f: any) => f.field === "q" || f.field === "email");
    const v = (q?.value as string) || "";
    if (v) search.set("q", v);
  }
  if (sorters && sorters.length) {
    const s = sorters[0] as any;
    const order: string = (s.order || '').toString().toLowerCase();
    const norm = order.includes('asc') ? 'asc' : order.includes('desc') ? 'desc' : 'desc';
    search.set("sort", `${s.field}:${norm}`);
  }
  return search.toString();
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord>({ resource, pagination, filters, sorters }: any) => {
    const qs = buildQuery({ pagination, filters, sorters });
    try {
      // Debug: verify pagination values making it to the provider
      // eslint-disable-next-line no-console
      console.debug('[admin:dataProvider] getList', resource, {
        current: pagination?.current,
        pageSize: pagination?.pageSize,
        qs,
      });
    } catch {}
    const res = await fetch(`${API_BASE}/api/admin/${resource}?${qs}`, { credentials: "include" });
    if (!res.ok) throw (await res.json()) as HttpError;
    const json = await res.json();
    return { data: json.data as TData[], total: json.total };
  },
  getOne: async <TData extends BaseRecord>({ resource, id }: any) => {
    const res = await fetch(`${API_BASE}/api/admin/${resource}/${id}`, { credentials: "include" });
    if (!res.ok) throw (await res.json()) as HttpError;
    const json = await res.json();
    return { data: json as TData };
  },
  update: async <TData extends BaseRecord>({ resource, id, variables, values }: any) => {
    const res = await fetch(`${API_BASE}/api/admin/${resource}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(variables ?? values),
    });
    if (!res.ok) throw (await res.json()) as HttpError;
    const json = await res.json();
    return { data: json as TData };
  },
  create: async <TData extends BaseRecord>({ resource, variables, values }: any) => {
    const res = await fetch(`${API_BASE}/api/admin/${resource}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(variables ?? values),
    });
    if (!res.ok) throw (await res.json()) as HttpError;
    const json = await res.json();
    return { data: json as TData };
  },
  deleteOne: async <TData extends BaseRecord>({ resource, id }: any) => {
    const res = await fetch(`${API_BASE}/api/admin/${resource}/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw (await res.json()) as HttpError;
    const json = await res.json();
    return { data: json as TData };
  },
  getApiUrl: () => API_BASE || "",
};
