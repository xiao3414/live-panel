import type { OemL1Node, OemL2Node } from "../navigation/oemNavTree";

type Props = {
  l1: OemL1Node;
  onPick: (l2: OemL2Node) => void;
};

export function OemModuleMenu({ l1, onPick }: Props) {
  return (
    <div className="oem-module-menu">
      <header className="oem-module-menu__head">
        <h2 className="oem-module-menu__l1">{l1.label}</h2>
        <p className="oem-module-menu__hint">
          选择子域进入配置面板（自动刷新设备状态，与 OEM 层级一致）
        </p>
      </header>
      <ul className="oem-module-menu__list">
        {l1.children.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              className="oem-module-menu__row"
              onClick={() => onPick(child)}
            >
              <span className="oem-module-menu__text">
                <span className="oem-module-menu__title">{child.title}</span>
                {child.subtitle ? (
                  <span className="oem-module-menu__sub">{child.subtitle}</span>
                ) : null}
              </span>
              <span className="oem-module-menu__chev" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
