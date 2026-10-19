type Props = {
  l1?: string;
  title: string;
  hint?: string;
};

/** OEM 中间层分区条（如 Network Configuration › WLAN） */
export function LayoutSectionBand({ l1 = "Network Configuration", title, hint }: Props) {
  return (
    <div className="layout-section-band">
      <div className="layout-section-band__crumb">
        <span className="layout-section-band__l1">{l1}</span>
        <span className="layout-section-band__sep" aria-hidden>
          ›
        </span>
        <span className="layout-section-band__l2">{title}</span>
      </div>
      {hint ? <span className="layout-section-band__hint">{hint}</span> : null}
    </div>
  );
}
