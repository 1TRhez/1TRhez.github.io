---
title: 更新日志~
date: 2026-04-18 2:08:14、
---

# — — 更 新 日 志 🛠️ — —

###### 其实是修bug日记 TvT

---

### 更新记录 (Changelog)

<div style="border-left: 2px solid #49b1f5; padding-left: 20px; margin-left: 10px;">

<div style="margin-bottom: 20px; position: relative;">
<strong style="color: #49b1f5;">v1.0.2 | 2026-04-19 凌晨 (生死时速版)</strong>
<p>
• <b>资源路径重构</b>：彻底解决 MarkText 自动转义绝对路径导致的“图裂”问题，统一回归 <code>/images/</code> 根目录逻辑。<br>


• <b>渲染机制纠偏</b>：手动将 Markdown 图片语法改为 HTML <code>&lt;img&gt;</code> 标签，强制锁定路径，绕过 Hexo 渲染歧义。<br>


• <b>SSH 端口突围</b>：在 22 端口被封锁的绝境下，通过配置 <code>config</code> 文件强制 SSH 走 <b>443 端口</b>，成功实现加密隧道连接。<br>


• <b>部署权限修复</b>：重置 ED25519 认证密钥并完成 GitHub 身份对等验证，解决 <code>Permission denied</code> 报错。<br>


• <b>自动化部署博弈</b>：在 GitHub Action 秘钥死锁与本地手动部署之间达成平衡，确保源码与静态网页双端同步。<br>


</p>
</div>

<div style="margin-bottom: 20px; position: relative;">
    <strong style="color: #49b1f5;">v1.0.1 | 2026-04-18 下午</strong>
    <p>
      • <b>副标题进化</b>：开启 shuffle 随机模式，让主页副标题文案随缘相遇。<br>
      • <b>标题修缮</b>：解决了 YAML 转义问题，修复了文章排版错乱的问题💢。<br>
      • <b>工具迁移</b>：日志编辑从PyCharm转向 MarkText 编辑器，效率提升。<br>
      • <b>捐赠入口</b>：点击微信图标或者侧边栏可以给我打钱ovo。<br>
      • <b>身份挂载</b>：正式添加“萌ICP备20268838号”。<br>
      • <b>脚本部署</b>：添加了GitHub Action秘钥报错弄得我头痛，不过最后还是成功了。<br>
    </p>

</div>

<div style="margin-bottom: 20px; position: relative;">
    <strong style="color: #49b1f5;">v1.0.0 | 2026-04-18 凌晨</strong>
    <p>
      • <b>站点诞生</b>：Hexo + Butterfly 框架成功部署于 GitHub。<br>
      • <b>域名绑定</b>：从localhost:4000挂到1TRhez.github.io~<br>
      • <b>配置对接</b>：完成 SSH 密钥绑定，实现本地一键推送。<br>
    </p>
  </div>

</div>
