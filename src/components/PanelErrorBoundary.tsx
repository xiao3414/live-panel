import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  title?: string;
};

type State = {
  error: Error | null;
};

/** 捕获子树渲染异常，避免整页黑屏 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[PanelErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel-error-boundary" role="alert">
          <h2>{this.props.title ?? "面板渲染出错"}</h2>
          <p style={{ color: "var(--err)" }}>
            {this.state.error.message || String(this.state.error)}
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => this.setState({ error: null })}
          >
            重试渲染
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
