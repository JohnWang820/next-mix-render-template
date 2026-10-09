# 共听空间 Demo

一个面向异地情侣的双人沉浸式共听 Demo。两个人选择形象与约会道具，在外滩江畔从黄昏待到霓虹亮起，并通过场景内点击完成坐下、依偎、点灯和道具互动；结束后会生成双方各自的约会日记。

## 技术栈

- Next.js App Router
- PixiJS 场景、角色与道具动画
- EdgeOne Pages 部署与 Cloud Functions
- EdgeOne Pages Blob 持久化空间、邀请、约会和日记状态

## 本地检查

```bash
npm install
npm test
```

Pages Blob 的自动认证只存在于 EdgeOne 运行环境，因此本地构建和静态测试可直接执行，完整双人数据流程请在 EdgeOne 部署地址验证。

## EdgeOne 部署

仓库已连接 EdgeOne Pages，`main` 分支提交后会自动触发生产部署。项目配置保持：

- Framework preset: Next.js
- Root directory: `./`
- Build command: `npm run build`
- Node.js: `22.11.0`

首次请求 `/api/space` 时，`@edgeone/pages-blob` 会自动创建名为 `gongting-space` 的存储，不需要手动填写数据库环境变量。
