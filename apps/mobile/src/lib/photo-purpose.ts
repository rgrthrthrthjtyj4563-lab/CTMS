/** Photo / attachment purpose options for field capture */
export const PHOTO_PURPOSES = [
  { key: 'SOURCE_DATA', label: '原始病历/源数据' },
  { key: 'DRUG', label: '药柜/药物管理' },
  { key: 'ICF', label: '知情同意' },
  { key: 'TEMP_LOG', label: '温度记录' },
  { key: 'SITE_FILE', label: '中心文件' },
  { key: 'OTHER', label: '其他（需备注）' },
] as const;

export type PhotoPurposeKey = (typeof PHOTO_PURPOSES)[number]['key'];

export function purposeLabel(key?: string | null): string {
  if (!key) return '未分类';
  return PHOTO_PURPOSES.find((p) => p.key === key)?.label ?? key;
}
