type Crumb = {
  label: string;
  onClick?: () => void;
  /** 项目根（OEM 2.0）：仅展示，不可点击 */
  projectRoot?: boolean;
};

type Props = {
  crumbs: Crumb[];
};

export function OemNavBreadcrumb({ crumbs }: Props) {
  return (
    <nav className="oem-nav-breadcrumb" aria-label="配置层级">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="oem-nav-breadcrumb__item">
            {i > 0 ? (
              <span className="oem-nav-breadcrumb__sep" aria-hidden>
                ›
              </span>
            ) : null}
            {c.projectRoot ? (
              <span className="oem-nav-breadcrumb__root">{c.label}</span>
            ) : last || !c.onClick ? (
              <span
                className={
                  last
                    ? "oem-nav-breadcrumb__current"
                    : "oem-nav-breadcrumb__link"
                }
              >
                {c.label}
              </span>
            ) : (
              <button
                type="button"
                className="oem-nav-breadcrumb__btn"
                onClick={c.onClick}
              >
                {c.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
