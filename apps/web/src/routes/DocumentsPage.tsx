/**
 * 文档中心 (Document Center).
 *
 * Lists project documents grouped by category, lets the user upload
 * a new document or a new version of an existing one, and shows the
 * audit chain on the detail drawer. Versions are immutable; supersession
 * is captured by uploading a new version. Cross-project isolation is
 * enforced server-side and surfaced via 403 toast errors.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card.js";
import { Tag } from "../components/ui/Tag.js";
import { Button } from "../components/ui/Button.js";
import { Modal } from "../components/ui/Modal.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { LoadingState } from "../components/ui/LoadingState.js";
import { SectionHeader } from "../components/ui/SectionHeader.js";
import { Drawer } from "../components/ui/Drawer.js";
import { pushToast } from "../components/ui/Toast.js";
import { AuditTrail } from "../components/ui/AuditTrail.js";
import {
  createDocument,
  getDocument,
  listDocuments,
  uploadDocumentVersion,
  type DocumentCategory,
  type DocumentDetailResponse,
  type DocumentListRow,
  type DocumentListResponse,
  type DocumentVersion,
} from "../lib/api/documents.js";
import { ApiError } from "../lib/api/client.js";

const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  Protocol: "方案文件",
  ICF: "知情同意书",
  Manual: "研究者手册",
  EthicsApproval: "伦理批件",
  VisitForm: "访视记录表",
  SAEReport: "SAE 报告",
  Other: "其他",
};

const CATEGORY_OPTIONS: ReadonlyArray<{
  value: DocumentCategory;
  label: string;
}> = (
  Object.keys(CATEGORY_LABEL) as DocumentCategory[]
).map((k) => ({ value: k, label: CATEGORY_LABEL[k] }));

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export function DocumentsPage() {
  const [rows, setRows] = useState<DocumentListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | "">("");
  const [q, setQ] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create document modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createCategory, setCreateCategory] = useState<DocumentCategory>("Protocol");
  const [createVersion, setCreateVersion] = useState("v1");
  const [createFileUrl, setCreateFileUrl] = useState("");
  const [createSha, setCreateSha] = useState("");

  // Upload new version modal
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [versionFileUrl, setVersionFileUrl] = useState("");
  const [versionSha, setVersionSha] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp: DocumentListResponse = await listDocuments({
        category: categoryFilter || undefined,
        q: q || undefined,
        pageSize: 50,
      });
      setRows(resp.items);
      setTotal(resp.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "文档列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await getDocument(id);
      setDetail(d);
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({
          tone: "error",
          title: "无法加载文档详情",
          description: e.message,
        });
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
  }, []);

  async function performCreate() {
    if (!createTitle.trim()) {
      pushToast({ tone: "error", title: "请输入文档标题" });
      return;
    }
    setSubmitting(true);
    try {
      const created = await createDocument({
        title: createTitle.trim(),
        category: createCategory,
        ...(createFileUrl && createSha
          ? {
              initialVersion: {
                version: createVersion || "v1",
                fileUrl: createFileUrl,
                sha256: createSha,
              },
            }
          : {}),
      });
      pushToast({
        tone: "success",
        title: "文档已上传",
        description: `${CATEGORY_LABEL[created.category as DocumentCategory] ?? created.category} · ${created.id}`,
      });
      setCreateOpen(false);
      setCreateTitle("");
      setCreateCategory("Protocol");
      setCreateVersion("v1");
      setCreateFileUrl("");
      setCreateSha("");
      await openDetail(created.id);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "上传失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function performUploadVersion() {
    if (!selectedId) return;
    if (!versionLabel.trim() || !versionFileUrl.trim() || !versionSha.trim()) {
      pushToast({ tone: "error", title: "请填写版本号、文件 URL 和 sha256" });
      return;
    }
    if (!/^[a-f0-9]{64}$/i.test(versionSha)) {
      pushToast({ tone: "error", title: "sha256 必须是 64 位十六进制" });
      return;
    }
    setSubmitting(true);
    try {
      const v = await uploadDocumentVersion(selectedId, {
        version: versionLabel.trim(),
        fileUrl: versionFileUrl.trim(),
        sha256: versionSha.toLowerCase(),
      });
      pushToast({
        tone: "success",
        title: "新版本已上传",
        description: `${v.version} · ${v.id.slice(0, 8)}`,
      });
      setVersionOpen(false);
      setVersionLabel("");
      setVersionFileUrl("");
      setVersionSha("");
      await openDetail(selectedId);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        pushToast({ tone: "error", title: "上传失败", description: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(() => {
    const byCategory: Partial<Record<DocumentCategory, number>> = {};
    for (const r of rows) {
      const k = r.category as DocumentCategory;
      byCategory[k] = (byCategory[k] ?? 0) + 1;
    }
    return byCategory;
  }, [rows]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="文档中心"
        sub="试验主文档（TMF）统一管理：分类、版本控制、审计链全留痕。"
        actions={
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            disabled={submitting}
          >
            上传新文档
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">分类分布</h3>
          <div className="space-y-2">
            {(
              Object.entries(summary) as Array<[DocumentCategory, number]>
            )
              .sort((a, b) => b[1] - a[1])
              .map(([cat, n]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">
                    {CATEGORY_LABEL[cat] ?? cat}
                  </span>
                  <Tag tone="neutral">{n}</Tag>
                </div>
              ))}
            {rows.length === 0 ? (
              <div className="text-xs text-slate-400">暂无数据</div>
            ) : null}
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
              共 {total} 个文档
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">过滤器</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                分类
              </label>
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as DocumentCategory | "")
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                <option value="">全部分类</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                关键字
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="按标题搜索"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">版本管理</h3>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              文档版本一旦上传即不可修改（仅可继续上传新版本）。每次版本变更都会写入
              AuditEvent，包含上传人、版本号和文件 sha256。
            </p>
            <p>
              已废弃：不再通过文件直接编辑；如需修正请上传 v2 / v3 ... 并在描述中注明。
            </p>
          </div>
        </Card>
      </div>

      {loading ? (
        <LoadingState label="正在加载文档列表..." />
      ) : error ? (
        <EmptyState title="加载失败" desc={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无文档"
          desc="点击右上角「上传新文档」开始。"
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              文档列表（{total} 条）
            </h3>
            <Badge tone="neutral">版本不可篡改</Badge>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b">
                  <th className="py-2 pr-3">标题</th>
                  <th className="py-2 pr-3">分类</th>
                  <th className="py-2 pr-3">更新时间</th>
                  <th className="py-2 pr-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-3 text-slate-700">{r.title}</td>
                    <td className="py-2 pr-3">
                      <Tag tone="neutral">
                        {CATEGORY_LABEL[r.category as DocumentCategory] ?? r.category}
                      </Tag>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {formatDate(r.updatedAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void openDetail(r.id)}
                      >
                        详情
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Drawer
        open={selectedId !== null}
        onClose={closeDetail}
        title={detail ? `${detail.document.title}` : "文档详情"}
        width={720}
      >
        {selectedId === null ? null : detailLoading ? (
          <LoadingState label="正在加载文档详情..." />
        ) : detail === null ? (
          <EmptyState title="无法加载详情" desc="请稍后重试" />
        ) : (
          <div className="space-y-5">
            <header className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag tone="neutral">
                  {CATEGORY_LABEL[detail.document.category as DocumentCategory] ??
                    detail.document.category}
                </Tag>
                {detail.document.currentVersionId ? (
                  <Badge tone="success">有现行版本</Badge>
                ) : (
                  <Badge tone="warning">尚未上传版本</Badge>
                )}
              </div>
              <div className="text-xs text-slate-500">
                创建 {formatDate(detail.document.createdAt)} · 更新 {formatDate(detail.document.updatedAt)}
              </div>
            </header>

            <section>
              <SectionHeader
                title="版本记录"
                sub="版本不可修改；supersession 通过上传新版本记录"
                actions={
                  <Button
                    size="sm"
                    onClick={() => {
                      setVersionLabel("");
                      setVersionFileUrl("");
                      setVersionSha("");
                      setVersionOpen(true);
                    }}
                    disabled={submitting}
                  >
                    上传新版本
                  </Button>
                }
              />
              {detail.versions.length === 0 ? (
                <Card>
                  <div className="text-xs text-slate-500">尚未上传任何版本</div>
                </Card>
              ) : (
                <div className="space-y-2">
                  {detail.versions.map((v: DocumentVersion) => (
                    <Card key={v.id}>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <Field label="版本号" value={v.version} />
                        <Field
                          label="状态"
                          value={v.isCurrent ? "当前版本" : "历史版本"}
                        />
                        <Field
                          label="上传人"
                          value={v.uploadedByUserId}
                        />
                        <Field label="上传时间" value={formatDate(v.uploadedAt)} />
                        <Field
                          label="sha256"
                          value={v.sha256.slice(0, 16) + "..."}
                        />
                        <Field label="文件 URL" value={v.fileUrl} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHeader title="审计链" sub="AuditEvent：仅追加、不可篡改" />
              <AuditTrail
                items={detail.auditTrail.map((a) => ({
                  time: a.timestamp,
                  user: `${a.actorRole} · ${a.actorUserId}`,
                  action: a.action,
                  result: "成功",
                }))}
              />
            </section>
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        variant="ai-confirm"
        title="上传新文档"
        body={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                标题
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                placeholder="例：临床试验方案 v3.0"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                分类
              </label>
              <select
                value={createCategory}
                onChange={(e) =>
                  setCreateCategory(e.target.value as DocumentCategory)
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              可选：上传首个版本（version + 文件 URL + sha256）。如果只创建空白文档可留空，后续再上传版本。
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  版本号
                </label>
                <input
                  value={createVersion}
                  onChange={(e) => setCreateVersion(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  文件 URL
                </label>
                <input
                  value={createFileUrl}
                  onChange={(e) => setCreateFileUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                sha256（64 位十六进制）
              </label>
              <input
                value={createSha}
                onChange={(e) => setCreateSha(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700 font-mono"
                placeholder="abcdef0123..."
              />
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performCreate()}
              disabled={submitting || !createTitle.trim()}
            >
              {submitting ? "提交中..." : "创建"}
            </Button>
          </>
        }
      />

      <Modal
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        variant="ai-confirm"
        title="上传新版本"
        body={
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                版本号
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
                placeholder="例：v2"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                文件 URL
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                value={versionFileUrl}
                onChange={(e) => setVersionFileUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                sha256（64 位十六进制）
                <span className="text-red-600 ml-0.5">*</span>
              </label>
              <input
                value={versionSha}
                onChange={(e) => setVersionSha(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-[var(--input-background)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] focus:border-[var(--ring)] text-slate-700 font-mono"
                placeholder="abcdef0123..."
              />
            </div>
            <div className="text-xs text-slate-500">
              新版本上传后会成为「当前版本」。已有版本不会被删除，可在详情中查看全部历史。
            </div>
          </div>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVersionOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => void performUploadVersion()}
              disabled={submitting}
            >
              {submitting ? "提交中..." : "上传"}
            </Button>
          </>
        }
      />
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-800 break-all">{value ?? "—"}</div>
    </div>
  );
}
