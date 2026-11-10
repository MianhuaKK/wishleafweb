# WishLeaf 下载意愿追踪

## 检查结果与当前状态

2026-10-31 检查：网站是原生 HTML/CSS/JavaScript 静态站点；`frontend` 是独立 Git 仓库，`CNAME` 为 `wishleaf.app`。无构建工具或后端分析接口；未发现 GA4、GTM、其他分析脚本、Cookie 横幅或已有同意状态。功能页原有 `data-download-location` 只是标记，并没有发事件。保留已有页面、动画、SEO 元数据与用户尚未提交的修改。

现统一加载 `analytics-config.js`、`analytics.js`、`analytics.css`，没有引入第二套分析 SDK。用户确认尚无 GA4，所以 `measurementId` 留空：**当前不会加载 Google 脚本、发送 GA 请求或设置分析 Cookie**。首页 5 个下载链接（含两个可点击二维码）、任务开始页 3 个按钮、进度追踪页 3 个按钮、AI Coach 页 3 个按钮已标注，共 14 个入口。其他页面加载同一模块以支持页面归因和隐私设置。

本地测试验证事件队列和页面集成；未创建 GA 账号、未连接真实数据流、未在真实 GA4 DebugView 验收，也未部署。完成下面的账号配置并部署后才能做真实接收验收。

## 接入 GA4

1. 在 Google Analytics 创建 GA4 属性，按团队需要选择报告时区，然后创建 Web 数据流，网站 URL 使用 `https://wishleaf.app`。
2. 复制数据流的 **Measurement ID**（`G-` 开头），填入 `analytics-config.js` 的 `measurementId`。它是公开 ID，不是 API Secret；不需要 Measurement Protocol Secret。将三个共享文件及引用它们的 HTML 一起发布到现有静态站点。
3. 不要另外粘贴 Google 安装向导的 gtag 代码，也不要再通过 GTM 发送同一个事件。模块负责唯一一次初始化和每页一次 `page_view`；重复加载本模块不会重复绑定监听器。检测到其他 Google tag 安装时，本模块停止初始化并提示控制台告警，需要先明确唯一的埋点所有者。
4. 在 Web 数据流的 **Enhanced measurement** 设置中，建议关闭 **Outbound clicks**（仅自定义事件负责下载 KPI），并关闭表单互动、站内搜索、视频等本项目未使用的自动测量。若保留自动外链用于诊断，务必遵守下方 KPI 规则。页面浏览高级选项中关闭浏览器历史变化触发，本站按完整 HTML 导航计页。
5. 在属性设置中保持 Google signals、广告个性化与不必要的 Ads 关联关闭；按需要设定数据保留时间。代码中也关闭了 Google signals 和广告个性化信号，广告相关 consent 一律 denied。

Consent 使用 basic 模式：同意前不下载 Google tag，也不发送无 Cookie ping；用户拒绝后不补发点击。Google 的 [Consent mode 指南](https://developers.google.com/tag-platform/security/guides/consent) 与 [隐私控制指南](https://developers.google.com/tag-platform/security/guides/privacy) 说明了同意状态和 `ga-disable-...` 开关。

## 事件和页面分类

事件名固定为 `app_store_click`，只监听正常左键/键盘激活与鼠标中键。右键、已取消的点击、非本 App 链接不计数。一次 DOM 点击只经过一个共享监听器；用户确实点两次会计两次，不等同于两次安装。

| 参数 | 示例 | 来源 |
| --- | --- | --- |
| `page_path` | `/features/action-start/` | 当前路径，`/index.html` 归一化为 `/`；仅允许配置中的公开路径 |
| `content_group` | `task_start` | `analytics-config.js` 的 `pages` 映射 |
| `cta_location` | `hero` | 下载链接的 `data-cta-location` |
| `destination` | `App Store` | 固定值 |

| 页面 | 内容主题 | 已有下载位置 |
| --- | --- | --- |
| `/` | `home` | `navigation`、`hero` × 2、`footer` × 2（按钮和可点击二维码） |
| `/features/action-start/` | `task_start` | `navigation`、`hero`、`footer` |
| `/features/goal-progress/` | `progress_tracking` | `navigation`、`hero`、`footer` |
| `/features/ai-coach/` | `ai_coach` | `navigation`、`hero`、`footer` |
| `/behind-wishleaf/` | `brand_story` | 当前无下载链接 |
| `/privacy/`、`/terms/`、`/support/` | `privacy`、`terms`、`support` | 当前无下载链接 |

页面底部 closing 区的下载 CTA 统一命名 `footer`。新增内容页时，添加三项共享资源，使用能正确解析的相对路径，并在 `pages` 中添加公开路径与内容主题；已有主题不需要另起命名。新增入口保留原生 `<a>`，添加 `data-app-store data-cta-location="inline"` 等属性。可用位置为 `navigation`、`hero`、`inline`、`footer`。模块也会识别未标注的同一 WishLeaf App Store 链接，位置按容器推断，未匹配时为 `inline`。

只调用同步的 gtag 队列，使用 beacon 传输提示；不使用 `preventDefault`、跳转回调、等待请求或计时后跳转。保留原有 `href`、`target`、`rel`，脚本未加载、广告拦截器、GA 请求失败或用户拒绝时仍可下载。浏览器关闭或拦截请求时仍可能丢失事件，不能保证每个点击必达。

## KPI 与报表，防止重复计数

**下载意愿 KPI = `event_name` 严格等于 `app_store_click` 的事件数。** 只将此事件标记为关键事件，按每次事件计数；不把 `click`、`page_view` 或 GA 派生事件加到下载点击数中。报告标题使用“App Store 点击 / 下载意愿”，不要写成“实际下载”。

GA4 自动外链事件叫 `click`，带 `outbound`、`link_domain` 和 `link_url`。如果保留自动外链，一次点击可能同时出现 `click` 与 `app_store_click`，这是两个观察维度，并非两次下载意愿。不要在 GA4 中再建立从 `click` 派生 `app_store_click` 的规则，不要给同一动作追加 GTM tag，也不要把两个事件都导入广告平台作为下载转化。见 [Google 外链测量说明](https://support.google.com/analytics/answer/13566436?hl=en)。

在 Admin → Custom definitions 创建事件范围维度 `cta_location`、`destination`。`content_group` 使用内置 **Content group**；页面使用内置 **Page path and screen class**，无需重复注册。`page_path` 仍随每个事件发送，可在 DebugView 查验。自定义维度通常需要 24–48 小时才可用于正式报表，见 [Google 自定义维度说明](https://support.google.com/analytics/answer/14239696?hl=en)。

在 Explore 新建自由形式探索：

- 筛选 Event name **exactly matches** `app_store_click`。
- 行：Page path and screen class → Content group → CTA location；值：Event count。需要区分点击人数时另加 Total users，不要把人数当点击数。
- 加入 Landing page、Session source / medium 或 Session default channel group，观察自然搜索和引荐来源的访问是否产生下载意愿。落地页代表访问起点，事件页面代表实际点击所在页。
- GEO 引荐可查看可识别的 AI 站点来源；未提供 referrer、跨设备与直接访问不能可靠归因。出于数据最小化，代码移除所有页面 query/hash，并将 referrer 截为 origin，因此不保留 UTM 和搜索词；部分来源会显示 Direct，不能据此认定没有 GEO 效果。

## 配置苹果 Campaign Link

在 App Store Connect → Apps → WishLeaf → Analytics → Acquisition → Campaigns → `+` 创建活动，**复制苹果生成的完整链接**。如新 App 尚无分析数据，可能暂时没有创建入口。不要自行编造 `pt`、`ct`、`mt`，不要从访客 URL 拼接参数，也不要将姓名、邮箱或任务内容写进活动名。

- 所有入口共用：填入 `appStoreCampaignUrl`。
- 按页面/按钮验证真实下载：在苹果侧分别创建所需活动，将完整链接填入 `appStoreCampaigns` 对应路径下的 `hero` / `inline` / `footer` / `navigation`；`default` 为该页兜底。
- 优先级：位置 → 页面 default → 全站链接 → HTML 原始 App Store URL。配置只接受 HTTPS `apps.apple.com` 上当前 WishLeaf App ID `6762046509`，错误域名或其他 App 不覆盖正常下载地址。保留完整已配置参数，不生成或追加 token。
- 活动链接解析与 GA 同意无关；拒绝 GA 的访客也可正常使用苹果链接。苹果侧处理适用 Apple 的隐私政策。
- **二维码图片**自身已编码原始下载 URL，修改二维码外层 `<a href>` 只影响点击图片。需要将真实 Campaign Link 重新制作成二维码并替换首页两处 `images/qr-code.png` 图片引用，或使用不同图片分别验证位置。扫码不会触发网页 `app_store_click`，不能把扫描计为网站点击。

## 隐私行为

- 没有 ID：默认关闭；页脚 Privacy settings 说明当前状态。
- 配置后首次访问：提供同等样式的允许/拒绝按钮；只在允许后加载 tag 和记录当前页，不补发同意前点击。
- 尊重 GPC / Do Not Track，优先于已保存同意；信号启用时不会提供允许按钮。
- 选择存储在本站 localStorage，最多 180 天；存储不可用时仅当前页有效。同意到期会停止采集。跨标签页变更自动同步。
- 页脚可撤回；设置 GA 禁用开关、更新 consent 并清除本站可访问的 `_ga` / `_ga_*` Cookie。已经到达 Google 的历史数据不会因此删除。
- 事件只取开发者配置的公开主题/位置和静态页面信息，不读用户表单、按钮文字、任务、账号、姓名或邮箱；页面 URL 去掉 query/hash，referrer 仅 origin，未知路径不采集。GA4 在同意后仍会接收连接信息并产生 Cookie 标识，不能称为完全匿名。发布时同步上线隐私页的说明。

## 验证步骤

### 本地回归

从 `frontend` 执行 `node --test tests/analytics.test.cjs`。测试使用本地 DOM 与 gtag 队列替身，不向 Google 发送数据。覆盖默认关闭、同意/拒绝/撤回/过期、隐私信号、重复初始化、参数清理、所有 HTML 入口、Campaign Link 兜底与跳转不被阻断。

### GA4 真实接收验收（配置 ID 并部署后）

1. 使用新浏览器会话访问首页和任务开始页；在 Network 检查同意前没有 `googletagmanager.com/gtag/js`、`google-analytics.com/g/collect` 请求。拒绝后点击下载，确认新标签页正常打开，GA 无事件。
2. 打开页脚 Privacy settings，允许分析。控制台执行 `WishLeafAnalytics.setDebug(true)`，然后刷新；此设置仅该标签页生效，刷新后 `page_view` 和点击携带 `debug_mode: true`。也可用 Google Tag Assistant。前往 GA4 Admin → Data display → **DebugView** 选择当前调试设备。
3. 逐个点击现有 14 个入口（可点其内部图标/文字），返回原页面，检查每个动作恰好一个 `app_store_click`，4 项参数和表中的位置一致。Network 的 collect 请求应具有 `en=app_store_click`，`ep.cta_location`、`ep.destination` 和主题/页面字段正确，使用真实 ID。
4. 若启用自动外链，对照自动 `click` 的 App Store 域名；确认报表只过滤自定义事件且没有 GA 创建事件规则或 GTM 重复发送。同样测试键盘 Enter、Ctrl/Cmd+点击与中键；右键打开菜单本身不计数。
5. 在测试 URL 的 query/hash 放入虚构测试值（不要使用真实个人信息），检查 GA 请求中的页面 URL 没有 query/hash；referrer 无路径和 query。检查 campaign 参数仍在最终 App Store 目的链接内，而不在自定义事件字段中。
6. 撤回同意后再点击，确认停止事件且 `_ga` Cookie 被清除。开另一标签页验证拒绝同步；启用浏览器隐私信号后重新加载，确认不加载 GA。阻断 Google 请求或禁用 JavaScript，下载仍正常。
7. 控制台执行 `WishLeafAnalytics.setDebug(false)` 并刷新以结束调试（必须刷新以移除初始化中的 debug 参数）。Realtime 可辅助确认生产事件；DebugView 没有未同意用户的事件是预期结果。流程参考 [Google DebugView 文档](https://support.google.com/analytics/answer/7201382?hl=en)。

### App Store Connect 下载验证

使用真实 Campaign Link 后，到 WishLeaf → Analytics → Metrics，Add Filter → Campaign，选择对应活动和日期范围，查看 **First-Time Downloads**、Total Downloads 与 Product Page Views；也可在 Acquisition → Campaigns 查看活动。按页面/位置分别创建活动，才能在苹果侧核对相同粒度。

苹果统计存在延迟和隐私门槛：活动通常至少经过 24 小时，达到最低数据量才显示；无数据不能直接视为零下载。首次下载采用苹果的活动归因窗口。统一日期、时区和活动范围后，把 GA 点击趋势与苹果下载趋势并排比较；重复点击、重新下载、不同设备、未同意、拦截器和扫码会使两侧数值不同，不能逐用户对账或声称点击就是安装。创建入口、门槛和当前归因规则以 [Apple Campaign links 官方说明](https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links) 为准。
