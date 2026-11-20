# Studio v3 COD-12 原生浏览器权限复验 · 2026-11-20

测试使用 Debian Chromium `151.0.7922.173`，通过 Xvfb 运行有界面浏览器并保留沙箱。每组使用独立配置，在 Chromium 自己的站点设置中变更权限。浏览器直接向 `http://127.0.0.1:4317` 发请求，伴随服务使用封存的 Docker 镜像。测试没有 Playwright 路由接管预检，没有推理或模型提供方请求，未创建工作区，表单始终为 `r0`。

## 公开版本基线

GitHub Pages 发布 `481e12e78a2e5f3d6a664726cbf52e6043877ce7` 的应用 SHA-256 为 `7cf9fe7d47a261104f1fe071c29c3bccc9c95eeda94321cf7913d2c4607178d6`。浏览器在全新配置下报告 `prompt`，页面直接完成配对和撤销，未观察到原生授权弹窗。另一个全新配置在站点设置中将本地网络与回环网络均设为「阻止」。页面在点击配对前查询两个权限均为 `denied`，配对后回环权限仍为 `denied`。伴随服务实际收到配对与撤销的 `OPTIONS 204` 和 `POST 200`，Chromium 记录的目标地址空间为 `Loopback`。拒绝状态在该环境下未阻止线上应用发起请求。 [公开 Studio](https://yapweijun1996.github.io/printform-js/studio-v3/)

## 修复版本本地 HTTPS

精确构建 `90c560120231d4868beadd130f0c34f457871d5f` 的应用 SHA-256 为 `8470f74cea5f04dcc473ff2a6791031356eb260d57670393e42523f3f8be9170`。测试从 `https://localhost:4493/studio-v3/` 加载生产构建。浏览器仅对临时 localhost 证书的公钥指纹使用证书信任例外，保留原生 CORS、Origin 和混合内容检查。

| Chromium 站点设置 | 实际结果 |
| --- | --- |
| 阻止 | 页面显示回环权限提示，伴随服务收到零次 `/v1/pair` 预检或请求 |
| 在同一会话改为允许 | 使用刚才的同一配对码成功配对并撤销。原生预检为 204，配对及撤销为 200，重复使用配对码为 403 |
| 全新配置直接允许 | 再次验证原生预检、配对、撤销和配对码单次使用 |

这两轮证据的伴随服务源码 SHA-256 为 `b6a89aa87b2f8ae3f17adc436fed6e47ef22c7862599bc3a76b5c509b69ef23b`，镜像为 `sha256:e1e20d5004eb9a5099fee5a1e30c4e5e8168106e39f76927fea8e61f3eddf147`。本地 HTTPS 验证覆盖应用读取浏览器拒绝状态后的拦截。修复版的 GitHub Pages 复验、原生首次授权弹窗、其他平台及剩余 COD-12 控制仍需各自的验证记录。 [COD-12 验收标准](../STUDIO_V3_CODING_AGENT_ACCEPTANCE.md)

## 后续发布版本复验

在公开的 `97a7d92` 上重复原生 Chromium 的拒绝与允许路径，使用已发布配套的 runner 源码 `78a4664416976fc3d597251efad692c859a4bcecbe8745a671aca0bfbcb6071b` 和镜像 `sha256:76badd727406b763e562556ba9cf53b1eb642dd9657674904ef7a20fa20b1537`。站点被拒绝时发出的配对请求为零。改为允许后完成配对与撤销。测试保持当前表单，未调用模型。其他平台和原生首次授权弹窗仍待验证。 [公开 Studio](https://yapweijun1996.github.io/printform-js/studio-v3/)
