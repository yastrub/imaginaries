"use client";
import { Card, Col, Row, Statistic, Typography, Space, Image as AntImage, Tag, Spin, theme, Drawer } from "antd";
import { Tiny } from "@ant-design/plots";
import { InfoCircleOutlined } from "@ant-design/icons";
import ImageDetailsCard, { AdminImage } from "../components/ImageDetailsCard";
import React from "react";

type TopLikedImage = {
  id: string;
  prompt: string | null;
  image_url: string | null;
  watermarked_url: string | null;
  likes_count?: number | string;
};

type PopularType = { label: string; count: number };
type ImagesPerDayPoint = { date: string; count: number };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";

function buildSrc(row: TopLikedImage): string | undefined {
  // Always prefer non-watermarked source for admin previews
  const filename = row.image_url || row.watermarked_url || undefined;
  if (!filename) return undefined;
  if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
  return ASSETS_BASE ? `${ASSETS_BASE.replace(/\/$/, "")}/images/${filename}` : `/images/${filename}`;
}

function useVisibleColumns(containerRef: React.RefObject<HTMLElement>, minItem = 110, gap = 8) {
  const [cols, setCols] = React.useState(4);
  React.useEffect(() => {
    const calc = () => {
      const w = containerRef.current?.clientWidth || window.innerWidth;
      const next = Math.max(2, Math.floor((w + gap) / (minItem + gap)));
      setCols(next);
    };
    calc();
    const handler = () => calc();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [containerRef, minItem, gap]);
  return cols;
}

export default function Dashboard() {
  const [topLiked, setTopLiked] = React.useState<TopLikedImage[]>([]);
  const [popularTypes, setPopularTypes] = React.useState<PopularType[]>([]);
  const [newImages, setNewImages] = React.useState<TopLikedImage[]>([]);
  const [imagesPerDay, setImagesPerDay] = React.useState<ImagesPerDayPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewRecord, setViewRecord] = React.useState<AdminImage | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [newUsers, setNewUsers] = React.useState(0);
  const [activeSubs, setActiveSubs] = React.useState(0);
  const [revenue, setRevenue] = React.useState(0);
  const [revenueByCurrency, setRevenueByCurrency] = React.useState<Array<{ code: string; amount: number }>>([]);
  const [totalUsers, setTotalUsers] = React.useState(0);
  const [totalImages, setTotalImages] = React.useState(0);
  const gap = 8;
  const newRef = React.useRef<HTMLDivElement>(null);
  const likedRef = React.useRef<HTMLDivElement>(null);
  const newCols = useVisibleColumns(newRef, 110, gap);
  const likedCols = useVisibleColumns(likedRef, 110, gap);
  const newVisibleCols = Math.max(1, Math.min(newCols, newImages.length));
  const likedVisibleCols = Math.max(1, Math.min(likedCols, topLiked.length));
  const { token } = theme.useToken();

  const findNewByUrl = (url: string): AdminImage | null => {
    for (const row of newImages) {
      const src = buildSrc(row);
      if (src === url) return row;
    }
    return null;
  };
  const findLikedByUrl = (url: string): AdminImage | null => {
    for (const row of topLiked) {
      const src = buildSrc(row);
      if (src === url) return row;
    }
    return null;
  };

  const openDetails = async (id: string) => {
    try {
      setViewOpen(true);
      setDetailsLoading(true);
      setViewRecord(null);
      const res = await fetch(`${API_BASE}/api/admin/images/${id}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setViewRecord(json);
      } else {
        // fallback to any existing data if fetch fails
        const fallback = (newImages as any[]).concat(topLiked as any[]).find((r) => r.id === id) || null;
        setViewRecord(fallback);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/dashboard`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const json = await res.json();
        setTopLiked(json.topLikedImages || []);
        setNewImages(json.newImages || []);
        setPopularTypes(json.popularJewelryTypes || []);
        setImagesPerDay(json.imagesPerDay || []);
        const m = json.metrics || {};
        setNewUsers(Number(m.newUsers24h || 0));
        setActiveSubs(Number(m.activeSubscriptions || 0));
        // Legacy single-currency revenue in cents
        const cents = Number(m.revenue30dCents || 0);
        setRevenue(Math.round((cents / 100) * 100) / 100);

        // New: revenue grouped by currency
        // Supported shapes:
        // - m.revenue30dByCurrencyCents: { USD: 12345, AED: 11900 }
        // - m.revenue30dByCurrency: { USD: 123.45, AED: 119 }
        // - m.revenue30dCurrencies: Array<{ code|currency: string; amount?: number; cents?: number }>
        const byCents = m.revenue30dByCurrencyCents && typeof m.revenue30dByCurrencyCents === 'object'
          ? m.revenue30dByCurrencyCents as Record<string, number>
          : null;
        const byAmount = !byCents && m.revenue30dByCurrency && typeof m.revenue30dByCurrency === 'object'
          ? m.revenue30dByCurrency as Record<string, number>
          : null;
        const byArray = !byCents && !byAmount && Array.isArray(m.revenue30dCurrencies)
          ? (m.revenue30dCurrencies as Array<any>)
          : null;
        if (byCents) {
          const entries = Object.entries(byCents)
            .filter(([code, val]) => typeof val === 'number' && !isNaN(val))
            .map(([code, val]) => ({ code, amount: Math.round((val / 100) * 100) / 100 }));
          setRevenueByCurrency(entries);
        } else if (byAmount) {
          const entries = Object.entries(byAmount)
            .filter(([code, val]) => typeof val === 'number' && !isNaN(val))
            .map(([code, val]) => ({ code, amount: Math.round(val * 100) / 100 }));
          setRevenueByCurrency(entries);
        } else if (byArray) {
          const entries = byArray
            .map((r) => {
              const code = (r.code || r.currency || '').toString().toUpperCase();
              const amount = typeof r.amount === 'number' ? r.amount : (typeof r.cents === 'number' ? r.cents / 100 : NaN);
              return { code, amount: Math.round((amount || 0) * 100) / 100 };
            })
            .filter((r) => r.code && !isNaN(r.amount));
          setRevenueByCurrency(entries);
        } else {
          setRevenueByCurrency([]);
        }
        setTotalUsers(Number(m.totalUsers || 0));
        setTotalImages(Number(m.totalImages || 0));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const typeColors = ["magenta","red","volcano","orange","gold","lime","green","cyan","blue","geekblue","purple"] as const;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Users"
              value={totalUsers}
              suffix={<span style={{ color: token.colorSuccess, marginLeft: 8 }}>+{newUsers}</span>}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Images" value={totalImages} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card><Statistic title="Active Subs" value={activeSubs} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            {revenueByCurrency.length > 0 ? (
              <Statistic
                title="Revenue (30d)"
                value={revenueByCurrency
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((r) => `${r.code === 'USD' ? '$' : ''}${r.amount.toFixed(2)} (${r.code})`)
                  .join(' + ')}
              />
            ) : (
              <Statistic title="Revenue (30d)" prefix="$" value={revenue} precision={2} />
            )}
          </Card>
        </Col>
      </Row>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>Daily Activity</Typography.Title>
        <Spin spinning={loading}>
          <div style={{ minHeight: loading && imagesPerDay.length === 0 ? 80 : undefined }}>
            <Tiny.Column
              {...{
                data: imagesPerDay.map((d, i) => ({ index: i, images: Number(d.count), date: d.date })),
                autoFit: true,
                height: 80,
                padding: 8,
                margin: 8,
                xField: "index",
                yField: "images",
                tooltip: {
                  showTitle: true,
                  title: (d: any) => d.date,
                },
                annotations: [
                  {
                    type: 'lineY',
                    data: [-5],
                    style: { arrow: false, stroke: 'gray', lineDash: [2, 2] },
                    label: {
                      text: ' ',
                      position: 'right',
                      dx: -10,
                      style: { textBaseline: 'bottom', fill: 'gray'  },
                    },
                  },
                ],
              }}
            />
          </div>
        </Spin>
      </Card>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>New Images</Typography.Title>
        <Spin spinning={loading}>
          <div style={{ minHeight: loading && newImages.length === 0 ? 160 : undefined }}>
            <AntImage.PreviewGroup
              preview={{
                toolbarRender: (node, info) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {node}
                    <InfoCircleOutlined
                      title="Details"
                      style={{ color: token.colorPrimary, fontSize: 18, cursor: "pointer" }}
                      onClick={() => {
                        const rec = findNewByUrl(info.image.url);
                        if (rec) {
                          openDetails(rec.id);
                        }
                      }}
                    />
                  </div>
                ),
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  ref={newRef}
                  style={{
                    display: "grid",
                    gridAutoFlow: "column",
                    gridAutoColumns: `calc((100% - ${gap}px * (${newVisibleCols}-1)) / ${newVisibleCols})`,
                    gap,
                    overflowX: "auto",
                    width: "100%",
                  }}
                >
                  {newImages.map((row) => {
                    const src = buildSrc(row);
                    if (!src) return null;
                    return (
                      <div key={row.id} style={{ position: "relative", width: "100%", paddingTop: "100%" }}>
                        <div style={{ position: "absolute", inset: 0 }}>
                          <AntImage
                            src={src}
                            alt={row.prompt || row.id}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                            preview={{ src }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AntImage.PreviewGroup>
          </div>
        </Spin>
      </Card>

      <Drawer
        title={viewRecord ? `Image: ${viewRecord.id}` : "Image"}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        width={510}
        destroyOnClose
        zIndex={token.zIndexPopupBase + 1000}
      >
        {detailsLoading || !viewRecord ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: "100%" }}>
            <Spin />
          </div>
        ) : (
          <ImageDetailsCard image={viewRecord} />
        )}
      </Drawer>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>Most Liked</Typography.Title>
        <Spin spinning={loading}>
          <div style={{ minHeight: loading && topLiked.length === 0 ? 160 : undefined }}>
            <AntImage.PreviewGroup
              preview={{
                toolbarRender: (node, info) => (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {node}
                    <InfoCircleOutlined
                      title="Details"
                      style={{ color: token.colorPrimary, fontSize: 18, cursor: "pointer" }}
                      onClick={() => {
                        const rec = findLikedByUrl(info.image.url);
                        if (rec) {
                          openDetails(rec.id);
                        }
                      }}
                    />
                  </div>
                ),
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  ref={likedRef}
                  style={{
                    display: "grid",
                    gridAutoFlow: "column",
                    gridAutoColumns: `calc((100% - ${gap}px * (${likedVisibleCols}-1)) / ${likedVisibleCols})`,
                    gap,
                    overflowX: "auto",
                    width: "100%",
                  }}
                >
                  {topLiked.map((row) => {
                    const src = buildSrc(row);
                    if (!src) return null;
                    const likes = Number(row.likes_count || 0);
                    return (
                      <div key={row.id} style={{ position: "relative", width: "100%", paddingTop: "100%" }}>
                        <div style={{ position: "absolute", inset: 0 }}>
                          <AntImage
                            src={src}
                            alt={row.prompt || row.id}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                            preview={{ src }}
                          />
                          <Tag
                            color="green"
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              userSelect: "none",
                              fontWeight: 600,
                            }}
                          >
                            {likes}
                          </Tag>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AntImage.PreviewGroup>
          </div>
        </Spin>
      </Card>

      <Card>
        <Typography.Title level={4} style={{ marginTop: 0 }}>Popular Jewelry Types</Typography.Title>
        <Spin spinning={loading}>
          <div style={{ minHeight: loading && popularTypes.length === 0 ? 160 : undefined }}>
            <Space size={[8, 8]} wrap>
              {popularTypes.map((t, i) => (
                <Tag key={t.label} color={typeColors[i % typeColors.length]} style={{ fontSize: 14, padding: "4px 8px" }}>
                  {t.label} — {t.count}
                </Tag>
              ))}
            </Space>
          </div>
        </Spin>
      </Card>
    </Space>
  );
}

