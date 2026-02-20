# HTTPS 配置完成说明

## ✅ 已完成的配置

1. **SSL 证书已获取**
   - 证书路径: `/etc/letsencrypt/live/nexus.mzhh.xyz/fullchain.pem`
   - 密钥路径: `/etc/letsencrypt/live/nexus.mzhh.xyz/privkey.pem`
   - 证书过期时间: 2026-01-29
   - 自动续期: 已配置（Certbot 会自动续期）

2. **系统 Nginx 配置**
   - HTTPS 监听端口: 443
   - HTTP 自动重定向到 HTTPS: ✅
   - 反向代理到 Docker 容器端口: 51001
   - WebSocket 支持: ✅
   - SSL 安全配置: ✅

3. **Vite 开发服务器配置**
   - 已添加 `nexus.mzhh.xyz` 到 `allowedHosts`
   - 已配置 `vite.config.ts` 并挂载到容器

## 📝 需要更新的配置

### 1. 更新 `.env` 文件中的 URL

请将以下环境变量中的 HTTP URL 更新为 HTTPS：

```bash
# OAuth 回调地址（如果有）
OAUTH_REDIRECT_URI=https://nexus.mzhh.xyz/oauth/callback

# 如果有前端基础 URL 配置
VITE_APP_URL=https://nexus.mzhh.xyz

# 其他可能需要更新为 HTTPS 的 URL
# 请检查所有包含域名的环境变量
```

### 2. 重启 Docker 服务

更新 `.env` 文件后，重启相关服务：

```bash
cd /home/ubuntu/code/nexus-playground
docker-compose restart backend frontend
```

## 🔍 验证配置

### 1. 检查 HTTPS 访问
```bash
curl -I https://nexus.mzhh.xyz
```
应该返回 200 状态码和 SSL 相关的头信息。

### 2. 检查 HTTP 重定向
```bash
curl -I http://nexus.mzhh.xyz
```
应该返回 301 重定向到 HTTPS。

### 3. 浏览器访问
访问 `https://nexus.mzhh.xyz`，检查：
- ✅ 浏览器地址栏显示锁图标
- ✅ 应用正常加载
- ✅ WebSocket 连接正常（如果有）
- ✅ OAuth 登录正常（如果有）

## 🔧 当前架构

```
Internet (HTTPS Port 443)
    ↓
系统 Nginx (处理 SSL)
    ↓ (反向代理到 localhost:51001)
Docker Nginx 容器 (Port 51001)
    ↓
├─→ Frontend 容器 (Port 5173)
└─→ Backend 容器 (Port 3000)
```

**关键点**:
- SSL 终止在系统 Nginx 层
- `X-Forwarded-Proto: https` 头会传递给 Docker 容器
- Docker 容器无需配置 SSL 证书
- 这是最常见和推荐的 Docker 部署架构

## 🔄 证书自动续期

Certbot 已设置自动续期任务。您可以查看续期配置：

```bash
# 查看 certbot 定时任务
sudo systemctl list-timers | grep certbot

# 手动测试续期（不会实际续期）
sudo certbot renew --dry-run
```

## ⚠️ 注意事项

1. **防火墙规则**: 确保服务器的 443 端口已开放
2. **OAuth 配置**: 如果使用 OAuth，需要在 OAuth 提供商处更新回调 URL 为 HTTPS
3. **混合内容警告**: 确保页面内的所有资源（图片、脚本等）也使用 HTTPS，避免混合内容警告
4. **CORS 配置**: 如果有 CORS 配置，确保允许 HTTPS 源

## 📚 相关文件

- 系统 Nginx 配置: `/etc/nginx/sites-available/nexus-playground`
- Docker Nginx 配置: `./nginx/nginx.conf`
- Vite 配置: `./frontend/vite.config.ts`
- Docker Compose: `./docker-compose.yml`
- 环境变量: `./.env`

## 🆘 故障排查

### 问题：浏览器显示"不安全"或证书错误
- 检查证书是否正确安装: `sudo certbot certificates`
- 检查 nginx 配置: `sudo nginx -t`
- 查看 nginx 错误日志: `sudo tail -f /var/log/nginx/error.log`

### 问题：OAuth 登录失败
- 确保 OAuth 提供商处的回调 URL 已更新为 HTTPS
- 检查 `.env` 文件中的 `OAUTH_REDIRECT_URI` 是否为 HTTPS
- 重启 backend 容器: `docker-compose restart backend`

### 问题：WebSocket 连接失败
- 检查浏览器控制台的错误信息
- 确保使用 `wss://` 而不是 `ws://`
- 检查系统 nginx 的 WebSocket 代理配置

### 问题：Mixed Content 警告
- 检查页面源代码中是否有硬编码的 `http://` URL
- 使用相对路径或协议相对 URL (`//example.com`)
- 检查 API 基础 URL 配置

