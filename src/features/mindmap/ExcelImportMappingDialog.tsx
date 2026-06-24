import { useEffect, useMemo, useState } from 'react';
import type {
  ExcelImportMapping,
  ExcelImportPreview,
  RawExcelRow,
} from './importExcel';
import {
  createExcelTableView,
  validateExcelImportMapping,
} from './importExcel';

type ExcelImportMappingDialogProps = {
  preview: ExcelImportPreview;
  onCancel: () => void;
  onConfirm: (mapping: ExcelImportMapping, rows: RawExcelRow[]) => void;
};

const mappingFields: Array<{
  key: keyof ExcelImportMapping;
  label: string;
  required: boolean;
}> = [
  { key: 'levelColumn', label: '节点层级列', required: true },
  { key: 'textColumn', label: '节点文本列', required: true },
  { key: 'remarkColumn', label: '节点备注列', required: false },
  { key: 'nodeTypeColumn', label: '节点类型列', required: false },
  { key: 'orderColumn', label: '创建顺序列', required: false },
];

export function ExcelImportMappingDialog({
  preview,
  onCancel,
  onConfirm,
}: ExcelImportMappingDialogProps) {
  const [hasHeader, setHasHeader] = useState(true);
  const tableView = useMemo(
    () => createExcelTableView(preview.sheetRows, hasHeader),
    [hasHeader, preview.sheetRows],
  );
  const [mapping, setMapping] = useState<ExcelImportMapping>(
    preview.suggestedMapping,
  );
  const canConfirm = validateExcelImportMapping(mapping);
  const sampleRows = tableView.rows.slice(0, 5);

  useEffect(() => {
    setMapping(tableView.suggestedMapping);
  }, [tableView.suggestedMapping]);

  return (
    <div className="excel-mapping-backdrop" role="presentation">
      <section
        className="excel-mapping-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-mapping-title"
      >
        <header className="excel-mapping-header">
          <div>
            <p className="eyebrow">Excel Import</p>
            <h2 id="excel-mapping-title">配置列映射</h2>
            <p className="panel-note">{preview.fileName}</p>
          </div>
          <button type="button" className="secondary-action" onClick={onCancel}>
            取消
          </button>
        </header>

        <label className="excel-header-mode">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(event) => setHasHeader(event.target.checked)}
          />
          第一行是表头
        </label>

        <div className="excel-mapping-grid">
          {mappingFields.map((field) => (
            <label className="excel-mapping-field" key={field.key}>
              <span>
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              <select
                value={mapping[field.key]}
                onChange={(event) =>
                  setMapping((currentMapping) => ({
                    ...currentMapping,
                    [field.key]: event.target.value,
                  }))
                }
              >
                <option value="">不导入</option>
                {tableView.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="excel-header-preview">
          <div className="remark-live-preview-title">
            预览模式：{hasHeader ? '第一行是表头' : '第一行不是表头'}
          </div>
          <div className="excel-header-list">
            {tableView.headers.map((header) => (
              <span key={header}>{header}</span>
            ))}
          </div>
        </div>

        {sampleRows.length > 0 ? (
          <div className="excel-sample-table-wrap">
            <table className="excel-sample-table">
              <thead>
                <tr>
                  {tableView.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {tableView.headers.map((header) => (
                      <td key={header}>{String(row[header] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!canConfirm ? (
          <p className="excel-mapping-warning">
            请至少选择“节点层级列”和“节点文本列”。
          </p>
        ) : null}

        <footer className="excel-mapping-actions">
          <button type="button" className="secondary-action" onClick={onCancel}>
            取消导入
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => {
              if (!canConfirm) {
                window.alert('请至少选择节点层级列和节点文本列');
                return;
              }

              onConfirm(mapping, tableView.rows);
            }}
          >
            确认导入
          </button>
        </footer>
      </section>
    </div>
  );
}
