import type { CompareRow } from "../expectCompare";
import {
  actualDisplayLabel,
  jsonOriginalConfigLabel,
} from "../expectCompare";
type Props = {
  row: CompareRow;
  /** MDM / 管理员策略锁定说明（与 OEM 不符且不可改时） */
  policyNote?: string;
};

/** 块内主区域：JSON 期望 vs 设备实况（与差异清单同源数据） */
export function OemBlockCompare({ row, policyNote }: Props) {
  const jsonOrig = jsonOriginalConfigLabel(row);
  const showPanelJson =
    row.expectedDisplay !== jsonOrig &&
    row.expectedDisplay !== row.expectedRaw;

  const deviceVal = actualDisplayLabel(row);
  const unread = row.status === "unread";
  return (
    <div
      className={`oem-block-compare oem-block-compare--${row.status}`}
      role="group"
      aria-label="配置对比"
    >
      <div className="oem-block-compare__col oem-block-compare__col--device">
        <span className="oem-block-compare__label">设备实况</span>
        <span
          className={`oem-block-compare__val ${unread ? "oem-block-compare__val--unread" : "oem-block-compare__val--mismatch"}`}
          title={deviceVal}
        >
          {deviceVal}
        </span>
      </div>
      <div className="oem-block-compare__mid" aria-hidden>
        →
      </div>
      <div className="oem-block-compare__col oem-block-compare__col--json">
        <span className="oem-block-compare__label">JSON 配置</span>
        <span className="oem-block-compare__val" title={jsonOrig}>
          {jsonOrig}
        </span>
        {showPanelJson ? (
          <span className="oem-block-compare__sub" title="映射为面板枚举值">
            映射：{row.expectedDisplay}
          </span>
        ) : null}
      </div>
      {policyNote ? (
        <div className="oem-block-compare__policy" title={policyNote}>
          {policyNote}
        </div>
      ) : null}
    </div>
  );
}
