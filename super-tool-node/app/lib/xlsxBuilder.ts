/**
 * @file XLSX 文件构建器
 * @description 将结构化数据生成 Excel (.xlsx) 文件，用于通知数据导出功能。
 *   支持多 Sheet、自动创建目录、返回文件大小。
 *
 * @module lib/xlsxBuilder
 */
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface SheetSpec {
  name: string;
  /** 表头数组（按顺序） */
  headers: string[];
  /** 每行对象，按 fields key 抽取 */
  rows: any[];
  /** 抽列的 key（与 headers 同长） */
  fields: string[];
}

export function buildXlsx(targetPath: string, sheets: SheetSpec[]): { size: number } {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: any[][] = [sheet.headers];
    for (const row of sheet.rows) {
      aoa.push(sheet.fields.map((k) => formatCell(row[k])));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  XLSX.writeFile(wb, targetPath, { bookType: 'xlsx' });
  const stat = fs.statSync(targetPath);
  return { size: stat.size };
}

function formatCell(v: any): any {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}
