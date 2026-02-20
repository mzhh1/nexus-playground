# HMR WebSocket 调试信息

## 问题
浏览器显示尝试连接 `https://nexus.mzhh.xyz:51001/`，导致 `ERR_SSL_PROTOCOL_ERROR`

## 根本原因
51001 端口是 Docker Nginx 容器端口，没有 SSL 证书。SSL 证书只在系统 Nginx（443 端口）上配置。

## 解决方案
已修复 Vite 配置，现在 HMR WebSocket 应该连接到 `wss://nexus.mzhh.xyz:443/`

## 当前配置验证

### 1. Vite 客户端代码
```javascript
const hmrPort = 443;
const socketHost = `${null || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port}${"/"}`;
// 结果应该是: nexus.mzhh.xyz:443
```

### 2. 系统 Nginx 配置
✅ 正确配置了 WebSocket 代理（Upgrade 和 Connection 头）
✅ 代理到 `http://localhost:51001`
✅ SSL 证书配置正确

### 3. 代理链路
```
浏览器 -> wss://nexus.mzhh.xyz:443/ (HTTPS/WSS)
  |
  v
系统 Nginx (443端口，有 SSL 证书)
  |
  v
Docker Nginx (51001端口，无 SSL)
  |
  v
Vite Dev Server (5173端口)
```

## 清除浏览器缓存步骤

### Chrome/Edge
1. 打开开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"（Empty Cache and Hard Reload）

或者：
1. 开发者工具 -> Application -> Clear storage
2. 点击 "Clear site data"
3. 刷新页面

### Firefox
1. 按住 Shift 键同时点击刷新按钮
2. 或者打开开发者工具 -> 存储 -> 清除所有数据

## 验证步骤

1. **清除浏览器缓存**（很重要！）
2. 刷新页面 `https://nexus.mzhh.xyz`
3. 打开开发者工具 -> Network 标签
4. 过滤 WS（WebSocket）类型的请求
5. 应该看到连接到 `wss://nexus.mzhh.xyz/`（不带端口号，或显示 :443）

## 预期结果

✅ WebSocket 连接状态：101 Switching Protocols
✅ 连接 URL：`wss://nexus.mzhh.xyz/` 或 `wss://nexus.mzhh.xyz:443/`
✅ 没有 SSL 错误
✅ 修改代码后页面自动热更新

## 如果仍然有问题

请提供以下信息：
1. 浏览器开发者工具 -> Network -> WS 标签的截图
2. 实际显示的 WebSocket 连接 URL
3. 浏览器控制台的完整错误信息

## 配置文件位置
- Vite 配置：`/home/ubuntu/code/nexus-playground/frontend/vite.config.ts`
- 系统 Nginx：`/etc/nginx/sites-available/nexus-playground`

