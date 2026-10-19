import type { OemProjectProfile } from "../navigation/oemProject";
import { OemProjectLogo } from "./OemProjectLogo";

type Props = {
  project: OemProjectProfile;
  moduleCount: number;
  onOpenConfig: () => void;
};

export function OemProjectOverview({
  project,
  moduleCount,
  onOpenConfig,
}: Props) {
  return (
    <div className="oem-project-overview">
      <header className="oem-project-overview__hero">
        <OemProjectLogo projectId={project.id} size={56} />
        <div>
          <h2 className="oem-project-overview__title">{project.title}</h2>
          <p className="oem-project-overview__tagline">{project.tagline}</p>
          <span className="oem-project-overview__badge">{project.id}</span>
        </div>
      </header>

      <div className="oem-project-overview__grid">
        <section className="oem-project-overview__card">
          <h3>说明</h3>
          {project.description.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </section>

        <section className="oem-project-overview__card">
          <h3>能力要点</h3>
          <ul className="oem-project-overview__highlights">
            {project.highlights.map((h) => (
              <li key={h.title}>
                <strong>{h.title}</strong>
                <span>{h.body}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {project.docLinks?.length ? (
        <section className="oem-project-overview__docs">
          <span className="oem-project-overview__docs-label">文档</span>
          {project.docLinks.map((d) => (
            <code key={d.href} className="oem-project-overview__doc-path">
              {d.label} · {d.href}
            </code>
          ))}
        </section>
      ) : null}

      <section className="oem-project-overview__actions">
        <button
          type="button"
          className="oem-project-overview__config-cta"
          disabled={moduleCount === 0}
          onClick={onOpenConfig}
        >
          配置项
        </button>
        <p className="oem-project-overview__actions-hint">
          {moduleCount > 0
            ? `进入 ${moduleCount} 个一级配置模块（Network、System 等），在配置项页以卡片选择模块。`
            : "该项目尚未挂载配置模块。"}
        </p>
      </section>
    </div>
  );
}
