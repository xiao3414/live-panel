import type { OemProjectProfile } from "../navigation/oemProject";
import { OemProjectLogo } from "./OemProjectLogo";

type Props = {
  projects: OemProjectProfile[];
  onOpenProject: (projectId: string) => void;
};

export function LivePanelProjectCatalog({ projects, onOpenProject }: Props) {
  return (
    <div className="livepanel-project-catalog">
      <header className="livepanel-project-catalog__head">
        <h2>项目</h2>
        <p>选择与 OEM 2.0 并列的实况调试项目；进入后可打开「配置项」浏览模块树。</p>
      </header>
      <div className="livepanel-project-catalog__grid">
        {projects.map((p) => {
          const planned = p.status === "planned";
          return (
            <article
              key={p.id}
              className={`livepanel-project-card${planned ? " is-planned" : ""}`}
            >
              <div className="livepanel-project-card__row">
                <OemProjectLogo projectId={p.id} size={44} />
                <div>
                  <h3>{p.shortTitle}</h3>
                  <span className="livepanel-project-card__slug">{p.id}</span>
                </div>
              </div>
              <p className="livepanel-project-card__tagline">{p.tagline}</p>
              {planned ? (
                <span className="livepanel-project-card__badge">规划中</span>
              ) : (
                <button
                  type="button"
                  className="livepanel-project-card__enter"
                  onClick={() => onOpenProject(p.id)}
                >
                  进入项目
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
