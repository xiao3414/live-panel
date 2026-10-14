# 推送到 GitHub（一次性）

工程已在本地提交：`git log -1`

## 1. 在 GitHub 网页新建空仓库

- 名称建议：`live-panel` 或 `shikuang-panel`
- **不要**勾选 “Add a README”（避免与本地冲突）
- 可见性：Private / Public 自定

## 2. 绑定并推送（PowerShell）

```powershell
cd "C:\Users\urovo\Desktop\测试知识库\10_工具开发\实况面板"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

若已安装 [GitHub CLI](https://cli.github.com/)：

```powershell
gh auth login
gh repo create live-panel --private --source=. --remote=origin --push
```

## 3. 更新文档

推送成功后，把 `README.md` 里 GitHub 一节改为实际仓库 URL。
