# dsh-better-sidebar 仓库规则（AGENTS）

> 本文只含**项目全局开发规则**（面向贡献者与 agent）。
> 消费插件接入 API 全参考（`ctx.betterSidebar` 服务、TabDescriptor / FileViewerDescriptor 全字段、声明式设置、原生右侧栏承载面、皮肤契约等）→ [docs/external-plugin-guide.md](docs/external-plugin-guide.md)；逐特性设计史（含实施偏差记录）→ [docs/plans/](docs/plans/)。

---

## 1. 仓库硬约束（必须遵守）

- **禁止修改 DSH 源码**：对官方 checkout（`~/.dsh/source/current`）零写入。
- **代码改动必须走 PR**：非文档改动在 `feat/*` / `fix/*` 分支开发，`gh pr create` 发起，review 合并后进 main；**仅纯文档改动**（README / AGENTS.md / docs/）允许直推 main。
- **挂载只走 `cordis.patch.yml` + profile 机制**（`~/.dsh/profiles/<profile>/`），插件作为独立包被 profile 引用，不反向侵入 DSH。
- **市场受管安装约束**：`dependencies` / `peerDependencies` / `optionalDependencies` **一律不得出现 `cordis`**（按名硬拒，optional 无效），`scripts` 不得含 `preinstall` / `install` / `postinstall` / `prepare`。由 `tests/market-manifest.spec.ts` 守护。
- 缺能力时用 DSH 现成只读/公开 API 或插件自有路由（如 `jobs.output` 事件回放：读会话事件日志而非动注册表）；做不到先向用户说明取舍，不改 DSH。

---

## 2. CI 挂载冒烟（`plugin-mount` job / `pnpm test:mount`）

「npm 打包 → 真实挂载 → 无头渲染」门禁（证明打包产物在真实 DSH 挂载后不 crash）：`pnpm build && pnpm pack` 产 tarball → `scripts/e2e-mount.sh` 装进全新 scratch profile（`dsh plugin --profile web add <tarball>`）并启动真实 `dsh web`（keyless，`--port 0`）→ `tests/e2e/mount.e2e.ts`（Playwright）断言 `[data-dsh-better-sidebar]` 挂载、无错误条/pageerror/console 错误，展开 DSH 原生右侧栏后经其 guide 页逐个打开本插件贡献的 tab 类型**以及宿主自己的终端 / 浏览器条目**（后者在宿主装了对应包时必须恰好 1 条——多于 1 条即意味着插件又在遮蔽宿主），再经插件文件树（原生 `files` kind 接管）打开 seed 文件强制加载 editor chunk（`client-editor.js`），并跑 mermaid / README 预览与 sidechat 宿主路由烟测。

本地：`pnpm build && pnpm pack && pnpm exec playwright install chromium && pnpm test:mount`（`DSH_CMD` 未设时 `scripts/e2e-common.sh` 回退的 npx 钉版是 `DSH_NPX_SPEC`，默认 `@deepseek-ai/dsh@0.1.6-alpha.2`——**不钉就会解析 `latest`，而 `latest` 仍是插件已不支持的 0.1.5 线**）。CI 钉 `@deepseek-ai/dsh@0.1.6-alpha.2`（npm `alpha`；`latest` 仍是 0.1.5-rc.2；peer 下限 `^0.1.6-alpha.2`）。该步骤用 `NODE_OPTIONS=--max-old-space-size=4096`：钉版自身的传递依赖是浮动 `^` 范围，上游分阶段发布预发布版时（rc.2 于 2026-09-10 的 14:43–14:57 逐包上线）npm 会组出混合 peer 图，3062 条 ERESOLVE 后 OOM（exit 134）；另一个失败模式是对未发布兄弟包 ETARGET，靠「钉一个已完整发布的版本」修掉。**不要加 `--legacy-peer-deps`**：它跳过的正是全局安装必须提供的 peer，`@deepseek-ai/dsh-app-boot` 在 boot 时 require 的 `@deepseek-ai/cordis-plugin-group` 是 peer 而非 dependency，加了它 CLI 直接 `ERR_MODULE_NOT_FOUND`（实测过一次，见 rc.2 计划 C 节）。`ci-windows` 的 `Test` 跑 `pnpm test:windows`（`--maxWorkers=1`）而非 `pnpm test`——多个 spec 真起进程（`smoke` / `install-powershell` / `git`；终端删除后 `agent-pty` / `pty-deps` / `pty-helpers` 已不在），2 核 runner 上并行起 ConPTY / 冷启 `powershell.exe` 是超时与 worker 静默死亡的放大器；`vitest.config.ts` 的全局 `testTimeout: 15_000`（默认 5000 在 Windows 上对真起进程的用例太低，三个不同文件先后翻车）是配套的一半。e2e spec 命名 `*.e2e.ts` + vitest `exclude` 双保险；**改 `exclude` 必须保留默认排除项**（exclude 整体替换默认值）。

---

## 3. DSH 0.1.6-alpha.2 适配要点（0.1.6-alpha.2+ 基线）

**v0.20.0（正式版，npm `latest`）起仅支持 DSH 0.1.6-alpha.2+**（peer 下限 `^0.1.6-alpha.2`，CI 钉 `@deepseek-ai/dsh@0.1.6-alpha.2`）。**下限必须动**：semver 的预发布规则要求比较子与候选版本同 `[major,minor,patch]` 元组，`^0.1.5-rc.1` 在数学上**永远容纳不下任何 `0.1.6-*` 预发布版**（实测：`0.1.6-alpha.2` 对 `^0.1.5-rc.1` / `^0.1.5-rc.2` / 裸 `*` 全部 false），而 `^0.1.6-alpha.2` 天然容纳 0.1.6 的 alpha/rc 全线。**支持线取舍**：0.1.5-rc.* 用户停留在 **v0.19.1**——rc.2 → alpha.2 有真实破坏（`SidebarRightGuideEntry.id` 必填、`conversation.chat.turnTail` chain→list），按本仓库先例（v0.19.0 抬到 0.1.5-rc.1 时直接桥掉 0.1.2 线）不写运行时兼容层；0.1.5-alpha.2 及更早同样停留在旧版。发版：release.yml 按版本号是否含 `-` 自动选 `alpha`/`latest` dist-tag（0.20.0 无后缀 → `latest`）。

**本版新增的两条硬契约（两者都是静默失败，已在 v0.20.0 修好并加测试守护）**：

1. **`SidebarRightGuideEntry.id` 必填且同一 provider 内唯一**（`tab-registry.ts`）：缺 `id` 时两个条目在 `undefined` 上相撞，`SidebarRightTabRegistry.register` 抛 `duplicate guide entry id`。抛点在本插件 `ctx.inject(['sidebarRightTabs'], cb)` 的**回调体内**，异常被 cordis 吞掉——症状是整个原生承载面**静默空掉**（指南无条目、`openTab` 全拒），没有任何其它提示。`src/client/native/index.ts` 的两个 guide 条目各自带 `id`（descriptor id / `files`），`tests/native-surface.spec.ts` 断言「每个 guide 条目都有非空且互不重复的 id」。同处还加了 `reportFailure` 上报口：任何 descriptor 注册失败走 `index.tsx` 的可见诊断条，且单个失败不再带走其余注册。
2. **`conversation.chat.turnTail` 由 `chain` 改为 `list`**（`ui-chat/src/client/contract/slots.ts`）：list 槽要求 `options.id`，传 `select` 直接抛 `list slot "…" requires options.id`。**语义变了**：chain 的 `select` 让一个条目**替换**内置产物行，list 只能**追加**——上游是有意为之（「An additive list lets both plugins contribute without either knowing the other's data or rendering」），所以插件再注册一行只会与内置的产物卡**重复**。插件的轮尾接管（`intercept.tsx` / `produced-files.ts`）因此整体删除，产物行交回宿主；它开文件走宿主 `openFile` → 本插件的 editor，行为不变。**副作用（已接受）**：失去 F5 式「在侧边栏文件树里揭示该文件」的入口（树内右键「在文件夹中显示」仍在）。

**本版新增的让位（宿主内置了插件原有的两个面）**：

3. **终端**：`@deepseek-ai/dsh-client-ui-sidebar-terminal`（+ `dsh-api-terminal-controller`）是宿主自己的右列终端类型。插件侧整个 PTY 栈（`pty-manager` / `agent-pty` / `pty-deps` / `tools.ts` / `TerminalView` / 终端字体与链接 / 跨会话固定终端 / xterm chunk）已删除，`node-pty` 依赖、`pnpm-workspace.yaml` 的 `allowBuilds`、安装脚本的 `-Repair` 模式随之移除。**模型侧代价**：插件原有的 8 个 `terminal_*` 工具（默认关）是模型唯一的**跨调用持久**终端，而上游等价物 `@deepseek-ai/dsh-tool-terminal` **未被任何 shipped bundle 默认挂载**——删除后模型只剩一次性 `bash` / `pwsh`。这是「不维护第二套 PTY」的既定代价，README 给出自行启用的指引。
4. **浏览器**：`@deepseek-ai/dsh-client-ui-sidebar-browser` 是宿主自己的 `browser` kind，且 `ui-chat` 已内置把正文里的 http(s) 链接委派给它（`ctx.sidebarRight.openTab('browser', { params: { url } })`）。插件删掉 `BrowserView` / `browser.ts` / `browser-probe.ts` 与自己的 `browser` tab 类型；**保留** DOM 层链接接管（宿主不做按协议分流，https 默认交系统浏览器是本插件唯一还能提供的能力）与已发布的 `urlTarget` 机制，接管目标改为**宿主的 browser kind**（`window.open` 兜底，宿主没装该包时不至于点了没反应）。宿主的 `browser` kind 不进插件注册表，所以 `browserNoSandbox` / `browserAllowedLoopback` 两个只配置插件自家 iframe 的设置项随 `browser.probe` 宿主路由一并删除。

**本版还需知道的**：

5. **原生右列布局现在会持久化**（`localStorage` `dsh.sidebar-right.v1.<sessionId>`，zod 校验，tab 体渲染前恢复）：§3.10 里「原生布局只在内存，不做持久化」的旧说法对 0.1.6 起**已失效**。同时新增 `ctx.sidebarRight.openTabs` / `tabsIn(sessionId)` / `registerCloseHandler(kind, handler)`（class 上而不在 `ISidebarRight` 接口里）、`SidebarRightTabDefinition.multiple`、`SidebarRightPlacement.preferNewPane`、keyed 槽 `sidebar.right.tab.guide.entry`。插件只用到 `multiple` 与既有面。
6. **`dsh.profile.patchReload` 已从 manifest 删除且零代码读取**（静默失效）：HMR 现在是 `packages/boot/hmr` 的一行。本仓库未使用它。
7. **`dsh.plugin.json` 从来不是 DSH 契约**：任何 DSH 版本都没有读它的代码（tag `dsh-v0.1.5-rc.2` / `dsh-v0.1.6-alpha.2` 全树 grep 均 0 命中）。DSH 真正读的是 `package.json` 的 `dsh.bundle.patch` + `dsh.client`（`platform`/`inject`/`immediately`/`external`）+ `exports["./client"]`。`dsh.plugin.json` 只服务第三方 registry（社区市场）通道，`lib/client-registry.js` 同理；`tests/manifest-consistency.spec.ts` 守护的是这条通道的形状，不是 DSH 契约。0.1.6 新增的官方管控面是 `packages/boot/plugin-manager`（`ctx.pluginManager` + `plugin_manager` 工具，需 `danger-full-access`）与 Web 的 Plugins 页——**两者都会零额外声明地接管任何已声明 `dsh.bundle.patch` 的包**，本插件无需适配。
8. **`@deepseek-ai/dsh-client-ui-primitives` 仍不声明 `dependencies`，且裸 import 的集合又变大了**：0.1.6-alpha.2 的 bundle 额外裸 import `diff` 与 `simple-icons`（前者此前只由传递依赖满足，后者是新引入的 3 万余品牌图标集，`lib/index.js` 里具名 import 32 个）。两者已提升进 devDependencies；`@deepseek-ai/dsh-code-runtime` 则**整包消失**（`packages/code-runtime` 已删，npm 上停在 0.1.5-alpha.2），devDependencies 同步移除。
9. **`ui-primitives` 本版的三处破坏**（已适配）：`IconSendOutline16` 不再导出（只剩 `IconSendOutline14`）；`TerminalBlockLabels` 新增必填的 `noExitCode`；`ConnectionIndicator` 删掉 `reconnectLabel`（断线标签现在**自身**命名重试动作，跟随宿主文案）。

宿主契约（0.1.5 线起沿用，均经真机挂载冒烟验证）：

1. **一次性 token 鉴权**：就绪行 `dsh web: http://127.0.0.1:<port>/?token=<43字符>`（导航换签名 cookie，干净 URL 401）。`e2e-mount.sh` 的 URL grep 必须延伸到空白（`[^ ]*`，在 `/` 截断丢 token）；e2e 统一走 `tests/e2e/host.ts`（token 必选：`parseLaunchUrl` 对裸 origin 直接抛错），带 stamps 导航走 `gotoPage()`（先 addCookies 再直达——token 换 cookie 的 303 会丢弃同 URL 其它 query 参数）。插件 `/sidebar/*` 路由不受影响，同源 fetch 照旧。
2. **Remote gateway 斜杠 RPC（唯一方言）**：`POST /api/workspace/create`，payload 恰为 `{args: {...}}`，**args 按控制器 TS 参数名包装**（`workspace/create`、`session/create` → `{args:{request:{...}}}`；`session/list` 参数名 `_request` **不可省略**——`{}` 也被拒 `args fields do not match the descriptor`）；envelope `method` 与路径一致，点分路径 404。请求由 `tests/e2e/host-protocol.ts` 的 `rpcAttempt` 构造、`tests/e2e-host-protocol.spec.ts` 锁定；要调新方法先在真机验参数名再进 `RPC_ARGS_KEY`。
3. **`MarkdownText` labels 嵌套契约**：必填 `labels: { code: { copyLabel, copiedLabel }, footnotes }`（漏传回退硬编码中文）。四个渲染点（mermaid.tsx / MarkdownHtml.tsx / TextEditor.tsx / SideChatView.tsx）统一走 `src/client/markdown-labels.tsx` 的 `markdownTextProps()`。
4. **侧边对话转录走自有路由，不碰客户端宿主 RPC**：`ctx.connection.api`（含 `sessions.history`）在 alpha.1 整体移除，继任 `session/follow|page` 又对 `origin:'subagent'` 会话强制 subagent 地址（普通 `{kind:'session'}` 被 `agent-busy` 拒）且分页 `throughSeq` 不得超当前游标。转录因此由 **`sidechat.events`** 插件路由供给（`src/sidechat-routes.ts`：live 读 `agent.session.snapshotEvents()`、冷读 `sessionPersistence.inspect`，服务端 `session/end-seed` 切割 + `afterSeq` 增量）；`ctx.connection` 镜像与 inject 已删。**0.1.5 起实时增量不在日志里**：`assistant/chunk` 事件被删除，进行中的模型增量改由 `agent/assistant-stream` 瞬时帧发布（`start` / `chunk` / `end`，不入会话日志），结算时才落 `assistant/message`（内嵌 `stream`）或 `assistant/attempt`（失败尝试，内嵌 `stream`）。插件在宿主侧 `src/assistant-live.ts` 折叠这些帧成有界缓冲，`sidechat.events` 的 `live` 字段按「当前 attempt 全量、每次轮询替换」下发（不是增量），转录映射与继承快照都读它。设计见 [docs/plans/2026-08-20-sidechat-tab-design.md](docs/plans/2026-08-20-sidechat-tab-design.md) §10。
5. **`dsh-settings` 无运行时 `settingsNamespace`**：命名空间合法性校验转为编译期模板字面量 `SettingsNamespaceInput`（小写字母开头 + `[a-z0-9-]` 尾部），`'dsh-better-sidebar'` 字面量直接过——宿主侧直接传常量（`src/index.ts` 的 settings inject）。
6. **`dsh-subagent` 的 `SUBAGENT_DESCRIPTOR_VERSION` 2 → 3**：sidechat 种子的 `subagent/descriptor` 版本由宿主包盖章，插件不硬编码；测试断言跟随常量（`tests/sidechat-routes.spec.ts`），勿钉字面量。
7. **`@deepseek-ai/dsh-client-runtime` 包已消亡**（继任 seed 是裸名 `dsh-client-store`，无 `/client` 子路径）：peerDependencies、devDependencies、`dsh.client.inject`、chunk externals 白名单（`src/client/chunk-loader.ts` / `tsdown.config.ts` / `tests/chunk-loader.spec.ts` / `tests/manifest-consistency.spec.ts` 四处同步）均已无该条目。
8. **e2e scratch profile 的 `minimumReleaseAgeExclude` 含 `'@deepseek-ai/*'`**（`scripts/e2e-mount.sh` / `e2e-aggregate-mount.sh`，与仓库根 `pnpm-workspace.yaml` 同策）：alpha 版本常在发布后 24h 内跑 lane，pnpm 11 的 `minimumReleaseAge` 默认会拒装新鲜包。
9. **插件开发树的 dsh-* 传递 peer 需提升为 devDependencies**（alpha.3 首见）：`dsh-subagent` 等 npm 包把 `dsh-attachment` 等 dsh-* 姊妹包全部声明为 peerDependencies（由宿主 bundle 树统一提供，宿主侧无此问题），插件仓库若只直接依赖其中一部分，其余 peer 在 pnpm 下会解析到树上残留的旧版——如 `dsh-attachment@0.1.1-rc.1` 缺 `admitPromptContent` 导出、`dsh-subagent` 产物 import 它时测试加载即崩。因此 devDependencies 需涵盖 dev 树实际触达的全部 peer（attachment / code-runtime / scope / session-projection / system-prompt / user-approval / util-time 七个即为此提升，与直接依赖同款精确钉版）；`@deepseek-ai/cordis` peer 自 alpha.3 起要求 `^4.0.2`（上游全线 peer 已升）。适配新 alpha 版本时先跑 `pnpm peers check`，把新失配的传递 peer 一并提升进 devDependencies。例外：**`dsh-client-locale` 的 peer/devDep 允许落后于基线**（alpha.5 时上游停在 0.1.2-alpha.3 未发新版）——peer 下限 `^0.1.2-alpha.3` 天然容纳同 tuple 的 alpha.5 运行时，此时保持旧钉版并在 `pnpm-workspace.yaml` 注明，待上游发版再追平；rc.1 起上游恢复发版，该包回到与 DSH 同 tuple（0.1.2-rc.1 → 0.1.5-rc.1，peer 下限 `^0.1.5-rc.1`），该例外消除。**alpha.2 起还有一类：上游包自身的 `dependencies` 丢失**——`@deepseek-ai/dsh-client-ui-primitives@0.1.5-alpha.2` 的 manifest 不再声明任何 `dependencies`（alpha.1 声明了 19 个），但 `lib/*.js` 仍裸 import `anser` / `shiki` / `@shikijs/langs/*` / `mdast-util-*` / `micromark-*` / `katex`。宿主由预构建前端 bundle 满足，独立安装的 dev/test 树不会——vitest 一碰 primitives 就 `Cannot find package 'anser'`。此时把 alpha.1 声明的同一组版本提升进 devDependencies（`clsx` 已在 dependencies 无需重复）。**rc.1 复查：`@deepseek-ai/dsh-client-ui-primitives@0.1.5-rc.1` 仍不声明任何 `dependencies`，bundle 仍裸 import 同一组包**（rc.2 同：只把 `CodeFileIcon` 的 SVG 数据拆进了新文件，无 `dependencies`）——这组提升不得回退，`pnpm peers check` / 单测一旦报 `Cannot find package 'anser'` 即是有人回退了。
10. **右侧栏是 DSH 原生栏，插件只提供 tab 类型**：聊天里一切文件打开（工具行 / 产物行 / 正文提及 / 行内代码路径）统一走 `ctx.sidebarRight.openResource(fileAddressFor(sessionId, cwd, path))`（`packages/client/ui-chat/src/client/apply.ts` 是唯一调用点），`remote.session.openWorkspacePath` 在 0.1.5 客户端已无调用者，插件的 openpath 拦截随之删除。插件的每个 `TabDescriptor` 注册成原生 tab 类型（`kind = descriptor.id`，`extension` 带）+ 原生 tab 体（`sidebar.right.pane.tab` keyed 槽，key = `dsh-better-sidebar:<id>`）；`editor` 类型同时认领 `dsh-resource://file/**`（压过内置 `text` 的 `fallback`），并接管内置 `files` 页面 kind（`openTab('files')` 打开插件文件树，注销即复位）。`ctx.sidebarRight.openTab/openResource/close` 只对**在屏会话**写入；跨会话用具体类上的 `openTabIn/openResourceIn/closeIn`（不在 `ISidebarRight` 接口里，需结构化探测），目标会话未挂载时排队到上屏重放（`src/client/native/surface.ts`）。原生 tab 的插件侧状态（合成 `SidebarTab`、树展开集合、实例编号）在 `src/client/native/tab-adapter.tsx`；**原生布局在 0.1.5 线只在内存，0.1.6 起由宿主持久化**（见上方第 5 条）。**注册必须等服务、不能等槽声明**：原生栏先声明 `sidebar.right.pane.tab` 再 `provide('sidebarRightTabs')`，真机 profile（web，0.1.5-alpha.1）上槽声明回调里 `ctx.get('sidebarRightTabs')` 仍是 undefined（实测 3 秒后才出现），按槽触发注册会静默什么都不注册且永不重试——用 `ctx.inject(['sidebarRightTabs'], cb)` 驱动类型注册（`tests/native-surface.spec.ts` 以「槽先触发、服务后到达」的顺序守护），槽声明只用来挂 tab 体。指南 §0 列了全部行为差异。**alpha.2 起（v0.19.0-alpha.1）**：指南条目一度改成「图标+标题」胶囊、`TabDescriptor.description` 随之下线，新建标签页的默认页改为从注册表选（恰好 1 个指南条目 → 直接开它，0 或 ≥2 → 开指南），`revealIfOpened` 对「页面」在同一 pane 内强制去重。**0.1.6-alpha.2 起**：`SidebarRightGuideEntry.id` 必填且同 provider 内唯一（见 §3 第 1 条——缺它会静默清空整个承载面）；同 provider 的 guide 条目是**追加**关系，`chain` 那种「替换宿主条目」的语义只存在于 `conversation.chat.turnTail` 且已被上游改成 `list`（§3 第 2 条）。原生 tab 体宿主 `.paneBody` 是**有确定高度的块级滚动容器**（非 flex 容器），native 适配层因此给每个 tab 体包一层 `height:100%` 的列 flex 宿主（`sidebar.module.css` 的 `.nativeTabHost`），tab 组件根继续用 `flex:1`/`height:100%`——否则根盒塌成内容高度，sidechat 的输入框就贴不到面板底。全局面板（根级 `main` keyed 槽 + `sidebar.panellist` + `ctx.layout.selectPanel/beginNavigation`、`rightbar` 改根级并新增 `rightbar.session`）插件**不接入**，只做兼容。底部工作台的中心列锚点改认 `[data-slot="main.conversation"]`（并跳过 `display: contents` 祖先，同时保留 alpha.1 的 `[data-slot="conversation"]`）；文件地址语法跟随 alpha.2（`fileAddressFor` 一律 session 作用域、绝对路径保留前导 `/`、`parseFileAddress` 前缀解析并去 `?`/`#`）。**rc.1 起（v0.19.0）**：`SidebarRightGuideEntry.description` 回归（可选），插件恢复 `TabDescriptor.description`，但**宿主的原生指南只在列出的条目 ≤ 4 条时渲染说明**（上游 `MAX_DESCRIBED_ENTRIES = 4`；更长的列表是整列丢弃，不是截断）——插件默认贡献 4 个 guide 条目（文件 / 文件变动 / 任务管理 / 侧边对话；终端与浏览器在 0.20.0 交还宿主），**与宿主自己的终端 / 浏览器条目合计后仍可能超过 4 条**，此时说明不渲染，只有读者在插件设置页关掉足够多 tab 类型把总数压到 ≤ 4 条时才出现；插件**不恢复**旧的 `nativeGuideDesc` 通用兜底句（宿主自己没有兜底，通用句是噪音），没声明说明的 descriptor 就不发 `description` 字段；条目缺 `icon` 时由宿主补方块占位。
11. **自定义种子必须带 fork 标记对（`meta.isSeeded: true` + `inheritedEventCount`）**：dsh-session 契约「只给 seed 不标 isSeeded，种子算重放历史而非继承前缀」——缺标记时 `Session.ownEvents()` 含整个种子，子会话的 inbox 折（`inboxProjectionDefinition`，0.1.5 起 `@deepseek-ai/dsh-agent` 只导出 `Inbox` 接口，实现是该投影）重放种子里的 `agent/inbox/spliced`，**继承父会话切割时刻未领取的 inbox 输入**（排队用户消息 next-turn、长回合中工具结果上下文/steering next-step——后者即「上下文很长时侧边对话先把之前的 User msg 发出去」的根因，幽灵消息排在 boundary 之前最先发给模型）。宿主 `session.fork`（api-session-controller）的调用即规范形态；回归由 `tests/sidechat-seed-validation.spec.ts`（真实 `Session.create` + 对 `ownEvents()` 跑 inbox 折）守护。0.1.5 复评：无更优雅的 sidechat 宿主 API（`ContinuableStartSpec` 仍无 seed 字段），`AgentRegistry.create` 接缝补齐标记即为规范用法；`Session.create` 的 header `version` 必须用 `SESSION_FORMAT_VERSION`（0.1.5 是 `3` 字面量类型），勿钉 `0`。

---

## 4. npm 发版（GitHub Release → npm publish）

`.github/workflows/release.yml` 在 GitHub Release（tag `vX.Y.Z`）发布时自动发 npm：

1. **前置**：`package.json` 版本 bump 到 `X.Y.Z`，CI 全绿后打 tag；tag 与版本不匹配直接失败。
2. **流程**：`pnpm build` / `typecheck` / `test` → 校验 tag → `pnpm publish --provenance --access public`。
3. **认证**：npm **Trusted Publishing（OIDC）**，不配 `NPM_TOKEN`。一次性配置（npmjs.com package → Settings → Trusted Publishers）：Provider `GitHub Actions`、Org `omdsh-dev`、Repo `DSH-better-sidebar`、Workflow filename `release.yml`、Environment 留空。
4. **调试**：`workflow_dispatch` + `dry_run=true` 只打包不发版。

---

## 5. 开发规则速查

- **构建纯度门**：client bundle 禁止 value-import `@dsh-external/*` 或非白名单 `@deepseek-ai/*`（`tsdown.config.ts` 拦截）；`import type {}` 被擦除不触发——类型可共享，运行时符号不行；跨插件交互走 `ctx.betterSidebar` 方法调用。
- **懒加载 chunk**：重依赖（CodeMirror / mermaid / 19 份第三语言词典）在独立 bundle（`lib/client-<name>.js`，0.20.0 起只剩 `editor` / `mermaid` / `locale`），经 `/sidebar/bundle` 按需下发、`globalThis.__dshChunks__` 物化（`src/client/chunk-loader.ts`），**核心 bundle 禁止静态 import `src/client/chunks/*`**。chunk 名在 8 处镜像（`tsdown.config.ts` / `src/bundle-route.ts` / `src/client/chunk-loader.ts` / `package.json.files` / `scripts/package-registry.mjs` / `tests/{bundle-route,chunk-loader,chunk-artifact,manifest-consistency}.spec.ts`）——删一个 chunk 必须同步全部。
- **i18n**：词典在 `betterSidebar` 命名空间，跟随 DSH `ctx.locale`；**新增 zh key 必须同步 `src/client/locales-ja.ts` 的 ja 翻译**（否则 ja 下回退 en）。渲染 `MarkdownText` 必须经 `markdownTextProps()`（§3 第 3 条）。
- **皮肤契约**：视觉值只消费 `--dsw-alias-*` / `--dsw-font-*` / `--ds-*` 令牌，无硬编码颜色，**插件没有任何豁免面**——文件/文件夹图标是 DSH 官方 `FileTypeIcon` 的图形（宿主自己的调色板），插件画的每个 glyph（含内置 tab 彩色图标）颜色都来自令牌；`tests/theme.spec.ts` 同时守护「图标模块零颜色字面量」「样式表每条 `color` 解析到令牌」「没有图标数据被做成 chunk」。契约全文与 titleBar 四方案模型见[指南 §12](docs/external-plugin-guide.md)，改动必须同步该节与 `tests/theme.spec.ts`。
- **契约反向引用**：皮肤契约被 `src/client/shell-presets.ts`、`tests/e2e/mount.e2e.ts` 的注释以「指南 §12」引用——调整指南章节结构时同步检查这两处。
- **接入 API 即文档**：`src/client/service.ts` 与 `src/client/builtins/` 的任何行为变更，必须同步 [docs/external-plugin-guide.md](docs/external-plugin-guide.md)（唯一权威接入文档，不再双份维护）。
- **文件/文件夹图标**：回退链是「具体 `names`/`exts` 注册 → catch-all（`exts: []`）→ 宿主 `FileTypeIcon`」。插件**不持有**扩展名表、图标数据或图标 chunk（#429 的 563 条数据与 `fileIconTheme` 开关在 rc.2 适配时删除，因为宿主已导出官方图形）。**语义雷区**：宿主分类器覆盖任意路径，所以注册 `exts: []` 会接管所有未具体命中的行——只想补几个类型的插件必须用 `exts`/`names`。
- **内置 tab 图标**：五个内置类型（文件 / 文件变动 / 任务管理 / 侧边对话 / diff）的 glyph 集中在 `src/client/builtins/tab-icons.tsx`（颜色在 `tab-icons.module.css`，全部 `--dsw-alias-*`），三处消费面自动同步：底部工作台 tab 条、原生指南胶囊、原生 tab 芯片。**原生芯片的图标是插件自己画的**——宿主的 `SidebarRightTabDefinition` 没有 icon 字段，但 `sidebar.right.pane.tab.title` 槽就是芯片内容（`NativeTabTitle` 渲染 `[glyph][title]`，glyph `aria-hidden` 以免改可访问名）。

---

## 6. 文档与测试地图

- **接入 API 全参考**：[docs/external-plugin-guide.md](docs/external-plugin-guide.md)（消费插件开发者向；§0 原生栏承载面 / §4 Tab API / §5 FileViewer API / §7 服务方法 / §10 平台陷阱 / §11 已移除的自由窗口 / §12 皮肤契约 / §15 真实案例）。
- **设计文档**：[docs/plans/](docs/plans/)（30+ 份逐特性设计，含实施偏差记录）。
- **关键测试守护**：`tests/service.spec.ts` / `builtins.spec.ts`（注册表与内置清单：**5 tab + 6 viewer**——终端与浏览器已交还宿主）/ `market-manifest.spec.ts`（市场约束，含 `pnpm pack` 后的产物面）/ `manifest-consistency.spec.ts`（registry 通道形状）/ `e2e-host-protocol.spec.ts`（RPC 双协议）/ `native-surface.spec.ts`（原生右侧栏承载面，含 guide 条目 id 唯一性）/ `theme.spec.ts`（皮肤契约，含空白面板胶囊几何）/ `plugin-list.spec.ts`（推荐插件目录）/ `fs-search.spec.ts`（host 文件名搜索）。
