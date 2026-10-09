# EdgeOne Pages Next.js 混合渲染模板

一个基于 **EdgeOne Pages** 和 **Next.js 15** 的混合渲染演示项目，展示 SSR、ISR、SSG、Streaming 等多种渲染策略，以及 Node Functions 和 Edge Functions 的使用。

## ✨ 功能特性

- 🚀 **混合渲染策略** - 演示 SSR、ISR、SSG、Streaming 等不同渲染方式
- ⚡ **现代前端** - Next.js 15 + React 18 + TypeScript
- 🎨 **美观 UI** - Tailwind CSS 4 + shadcn/ui 组件库
- 🔧 **开箱即用** - 预配置的开发环境和构建流程
- 📱 **移动优先** - 完全响应式设计，支持所有设备
- 🌐 **边缘计算** - 支持 Node Functions 和 Edge Functions

## 🛠️ 技术栈

### 前端
- **Next.js 15.4.7** - React 全栈框架
- **React 18.3.1** - 用户界面库
- **TypeScript 5** - 类型安全的 JavaScript
- **Tailwind CSS 4** - 实用优先的 CSS 框架
- **shadcn/ui** - 现代化 UI 组件库

### 后端
- **EdgeOne Pages** - 边缘计算平台
- **Node Functions** - Node.js 运行时函数
- **Edge Functions** - 边缘运行时函数

### 开发工具
- **ESLint** - 代码质量检查
- **PostCSS** - CSS 后处理器
- **Turbopack** - 快速构建工具

## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- EdgeOne Pages 账户

### 安装依赖

```bash
# 克隆项目
git clone <your-repo-url>
cd next-mix-template

# 安装依赖
npm install
```

### 本地开发

```bash
# 启动开发服务器
edgeone pages dev

# 访问 http://localhost:6699
```

### 构建

```bash
# 构建生产版本
edgeone pages build
```

## 📚 功能演示

### 混合渲染策略

**SSR (服务器端渲染)**
- 路径: `/ssr`
- 特点: 每次请求都在服务器端重新渲染
- 适用: 动态内容和个性化页面

**ISR (增量静态再生)**
- 路径: `/isr`
- 特点: 静态生成 + 定时增量更新
- 适用: 新闻或博客网站

**SSG (静态站点生成)**
- 路径: `/ssg`
- 特点: 在构建时预生成所有页面
- 适用: 企业官网和静态内容

**Streaming (流式渲染)**
- 路径: `/streaming`
- 特点: 逐步渲染页面内容，提升用户体验
- 适用: 数据密集型页面和复杂内容

### 服务器函数

**Node Functions**
- 路径: `/node-functions`
- 特点: 在 Node.js 运行时运行代码
- 适用: 复杂后端逻辑和数据处理

**Edge Functions**
- 路径: `/edge-functions`
- 特点: 在边缘运行时运行代码
- 适用: 实时数据处理和地理位置服务

## 🗄️ 项目结构

```
next-mix-template/
├── src/                    # 源代码目录
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx     # 根布局组件
│   │   ├── page.tsx       # 首页组件
│   │   ├── ssr/           # SSR 演示页面
│   │   ├── isr/           # ISR 演示页面
│   │   ├── ssg/           # SSG 演示页面
│   │   ├── streaming/     # Streaming 演示页面
│   │   ├── node-functions/# Node Functions 演示页面
│   │   ├── edge-functions/# Edge Functions 演示页面
│   │   ├── api/           # API 路由
│   │   └── globals.css    # 全局样式
│   ├── components/        # React 组件
│   │   ├── ui/           # shadcn/ui 组件库
│   │   ├── Header.tsx    # 页面头部组件
│   │   ├── Hero.tsx      # 英雄区域组件
│   │   ├── Features.tsx  # 功能特性组件
│   │   └── FeatureCard.tsx # 功能卡片组件
│   └── lib/              # 工具函数
├── public/               # 静态资源
├── package.json          # 项目配置
├── next.config.ts        # Next.js 配置
├── tailwind.config.ts    # Tailwind CSS 配置
├── tsconfig.json         # TypeScript 配置
└── components.json       # shadcn/ui 配置
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](https://github.com/github/choosealicense.com/blob/gh-pages/_licenses/mit.txt) 文件了解详情。

## 🚀 一键部署

[![Deploy with EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?from=github&template=next-mix-render-template)
