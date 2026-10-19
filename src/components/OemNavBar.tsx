import { OemNavBreadcrumb } from "./OemNavBreadcrumb";

type Crumb = {
  label: string;
  onClick?: () => void;
  projectRoot?: boolean;
};

type Props = {
  crumbs: Crumb[];
  /** 返回上一级（页面导航，非布局撤回） */
  onBack?: () => void;
};

function NavBackIcon() {
  return (
    <svg
      className="oem-nav-back__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function OemNavBar({ crumbs, onBack }: Props) {
  const back = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onBack?.();
  };

  return (
    <div className="oem-nav-bar">
      {onBack ? (
        <button
          type="button"
          className="oem-nav-back"
          aria-label="返回上一级"
          title="返回上一级（左键 / 右键）· 块标题右键为布局撤回"
          onClick={back}
          onContextMenu={back}
        >
          <NavBackIcon />
        </button>
      ) : null}
      <div className="oem-nav-bar__trail">
        <OemNavBreadcrumb crumbs={crumbs} />
      </div>
    </div>
  );
}
