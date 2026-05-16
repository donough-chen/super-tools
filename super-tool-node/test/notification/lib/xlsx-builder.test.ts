import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildXlsx } from '../../../app/lib/xlsxBuilder';

describe('lib/xlsxBuilder', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = path.join(os.tmpdir(), `xlsx_${Date.now()}_${Math.random()}.xlsx`);
  });
  afterEach(() => { try { fs.unlinkSync(tmp); } catch (_) {} });

  it('生成单 sheet 文件', () => {
    const r = buildXlsx(tmp, [{
      name: 'Test', headers: ['ID', 'Name'], fields: ['id', 'name'],
      rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    }]);
    expect(fs.existsSync(tmp)).toBe(true);
    expect(r.size).toBeGreaterThan(0);
  });

  it('多 sheet 文件', () => {
    buildXlsx(tmp, [
      { name: 'A', headers: ['x'], fields: ['x'], rows: [{ x: 1 }] },
      { name: 'B', headers: ['y'], fields: ['y'], rows: [{ y: 2 }] },
    ]);
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(tmp);
    expect(wb.SheetNames).toEqual(['A', 'B']);
  });

  it('Date 字段格式化为 ISO', () => {
    buildXlsx(tmp, [{
      name: 'T', headers: ['T'], fields: ['t'],
      rows: [{ t: new Date('2026-06-01T00:00:00Z') }],
    }]);
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(tmp);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets.T, { header: 1 });
    expect(aoa[1][0]).toBe('2026-06-01T00:00:00.000Z');
  });

  it('null/undefined → 空字符串', () => {
    buildXlsx(tmp, [{
      name: 'T', headers: ['v'], fields: ['v'],
      rows: [{ v: null }, { v: undefined }],
    }]);
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(tmp);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets.T, { header: 1, defval: '' });
    expect(aoa[1][0]).toBe('');
    expect(aoa[2][0]).toBe('');
  });
});
