import type { CompareRow } from "../expectCompare";
import {
  actualDisplayLabel,
  jsonOriginalConfigLabel,
} from "../expectCompare";
import type { ProbeMeta } from "../types";
import { probeBlockTitle } from "../probeTitles";

type Props = {
  rows: CompareRow[];
  probeMeta: Map<string, ProbeMeta>;
};

export function OemCompareDiffTable({ rows, probeMeta }: Props) {
  if (!rows.length) return null;
  return (
    <div className="oem-diff-table-wrap">
      <table className="oem-diff-table">
        <thead>
          <tr>
            <th scope="col">配置项</th>
            <th scope="col">JSON 配置</th>
            <th scope="col">设备实况</th>
            <th scope="col">状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const title = probeBlockTitle(
              r.probeId,
              probeMeta.get(r.probeId)?.item,
            ).main;
            const jsonOrig = jsonOriginalConfigLabel(r);
            const panelExpect =
              r.expectedDisplay !== jsonOrig ? r.expectedDisplay : null;
            return (
              <tr
                key={r.probeId}
                className={`oem-diff-table__row oem-diff-table__row--${r.status}`}
              >
                <td className="oem-diff-table__item">{title}</td>
                <td className="oem-diff-table__json">
                  <span className="oem-diff-table__json-main">{jsonOrig}</span>
                  {panelExpect ? (
                    <span className="oem-diff-table__json-sub" title="面板映射">
                      → {panelExpect}
                    </span>
                  ) : null}
                </td>
                <td className="oem-diff-table__device">
                  {actualDisplayLabel(r)}
                </td>
                <td className="oem-diff-table__status">
                  {r.status === "mismatch" ? "不符" : "未读到"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
