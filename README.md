# 周末去哪玩 · 上海

> 刷两小时小红书，不如让机器替你选。上海展览 · 市集 · 节庆 + 周边游清单，一键决定这周末去哪。

一个给「周末不知道干嘛」用的静态决策站：市内把上海正在进行的展览、市集、节庆整理成结构化清单，
市外加一层**周边游**（安吉、莫干山、舟山、千岛湖、黄山……从当天往返的穷游到三天两夜的远方），
支持按 **类型 / 免费 / 不用预约 / 区域 / 行程长度** 筛选，还有个 **「帮我选一个」** 的加权随机按钮。

两类数据的排序逻辑不同：**市内活动按剩余天数排**（快结束的在前，避免错过），
**周边游常年可去**，所以沉底并按推荐度排。

零依赖、零构建：`index.html` + 一个数据文件 + 一点原生 JS，GitHub Pages 直接托管。

## 描述语备选（GitHub About / 分享卡片用）
| 场景 | 文案 |
|---|---|
| **推荐** | 刷两小时小红书，不如让机器替你选 —— 上海展览·市集·节庆决策器 |
| GitHub About（短） | 周末去哪玩：上海展览/市集/节庆结构化清单，支持筛选与「帮我选一个」加权随机决策 |
| 一句话讲清价值 | 把「周末干嘛」从两小时刷帖，压缩成一次点击 |
| 分享/朋友圈 | 上海这周末有什么好玩的？我做了个站，点一下它就替你决定了。 |

**当前采用的**：推荐版（见上方引用块与 `index.html` 的 title / meta）。


## 本地预览

直接双击 `index.html` 就行（数据写在 `data/activities.js` 里，不依赖 fetch，`file://` 也能跑）。

或者起个服务：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 怎么加一个新展

只改 `data/activities.js`，往数组里加一条：

```js
{
  id: 'unique-id',
  name: '展览名',
  type: 'exhibition',        // exhibition | market | event
  venue: '场馆名',
  district: '浦东',           // 用于区域筛选
  address: '详细地址',
  start: '2026-09-25',
  end: '2026-11-15',
  closedDay: '周一闭馆',
  hours: '10:00-21:00',
  price: { free: false, amount: '80 元起', note: '补充说明' },
  booking: {
    required: true,
    level: 'medium',         // none 不用预约 | easy 很简单 | medium 需预约 | hard 需实名抢 | unknown 待开放
    realName: '实名要求说明',
    channel: '「XX」微信小程序',
    steps: ['第一步', '第二步'],
    tip: '提醒，比如快结束了 / 别买黄牛票'
  },
  highlight: '看点一句话',
  tags: ['限时', '免费'],
  rating: 5                   // 1-5，影响「帮我选一个」的权重
}
```

`rating` 越高越容易被随机选中；剩余 ≤10 天、免费的项目也会加权。

## 看展 / 看演出前科普（`data/guides.js`）

给展览 / 演出卡片加一个可折叠的「📚 看展前科普」块，回答三个问题：**看什么、先补什么、适合谁**。按 **活动 id** 索引，与 `activities.js` / `shows.js` 里的 `id` 一一对应；**只给 cultural 类（展览 / 演出）写就行**，市集 / 周边游不写也不会报错（没有对应条目就不渲染）。

```js
window.GUIDES = {
  'world-tree': {                       // = activities.js / shows.js 里的 id
    intro: '内容速览：这是什么、能看到什么。',   // 一到两三句
    books: [                            // 看前先补什么（书 / 纪录片 / 音乐选段），每项一句话
      '《枪炮、病菌与钢铁》贾雷德·戴蒙德 —— 为什么值得先读'
    ],
    audience: '适合：…… 不太适合：……',       // 帮读者判断要不要去
    links: [{ t: '上海博物馆官网', u: 'https://www.shanghaimuseum.net/' }]  // 可选
  }
};
```

- 卡片展开区里会在「看点 / 怎么预约」之上插入这块科普，渲染逻辑在 `assets/app.js`（`guideHTML`）与 `assets/shows.js`（`guideHTML`）。
- **内容只做观前科普 + 选书建议，不替代官方展讯**；票价、档期以卡片与官方为准，别在这里写死。
- 加完记得把 `index.html` / `shows.html` 里 `data/guides.js` 的 `?v=` 一起 +1（缓存）。

## 剧本杀板块（`scripts.html` + `data/scripts.js`）

第 4 个板块：**选本参考**（不是排行榜）。数据全在 `data/scripts.js`，页面是 `scripts.html`，渲染引擎 `assets/scripts.js`。

```js
window.SCRIPTS = [{
  id: 'chifu-aofu',                 // 唯一 id，同时是划词批注的锚点
  name: '持斧奥夫',
  cat: 'classic',                   // 'classic' 公认经典 | 'new' 2026 新本（榜单口径）
  genre: 'hard',                    // 主类型，用于筛选：hard 硬核推理 | bian 变格科幻
                                    //   horror 恐怖惊悚 | emo 情感沉浸 | fun 机制欢乐
                                    //   guofeng 古风家国 | newbie 新手友好
  genres: ['硬核', '本格', '还原'],   // 展示用类型标签
  players: '6 人（4 男 2 女）',       // 展示文案
  pmin: 5, pmax: 7,                 // 人数区间，用于「5 人及以下 / 能开 6 人 / 7 人及以上」筛选
  duration: '5–6 小时',
  dmin: 5, dmax: 6,                 // 时长区间（小时），用于「4.5 小时内 / 4–5.5 小时 / 5 小时以上」
  diff: 5,                          // 难度 1–5
  year: '2021', mode: '城限', publisher: 'LARP',   // 都可留空
  highlight: '这本是什么（卡片展开区第一段）',
  forWho: '适合谁打',
  note: '上车前要知道 / 注意点',
  tags: ['叙诡天花板', '硬核必玩'],
  conf: 'high'                      // 'high' | 'mid'，mid 会在卡片上标「🟡 榜单口径」
}];
window.SCRIPTS_META = { verifiedAt: '2026-09-21', city: '上海', note: '…口径声明…', priceRef: [{k,v,d}] };
```

- 筛选维度：类型 / 难度 / 人数 / 时长 / 经典或新本；排序：推荐排序（经典本优先 → 难度高在前）/ 难度升降 / 时长升。
- 「帮我选一个本」= 在当前筛选结果里按「经典本 + 口径可靠 + 好凑局」加权随机。
- **数据纪律（重要）**：人数 / 时长 / 难度照抄公开榜单聚合时必须标 `conf: 'mid'`，页面会显示 🟡 并提示「以店家当期本单为准」；**不要编造发行方、价格和门店排名**。价格只给行业通行区间（`priceRef`），不写某家店报价。
- 加完记得把 `index.html` / `shows.html` / `scripts.html` 里 `?v=` 一起 +1（缓存），并确认 `index.html` 的 `.hud` 里 `#hk-scripts` 能取到 `window.SCRIPTS.length`。

## 怎么加一个周边游（`type: 'trip'`）

周边游**没有展期**，所以 `start` / `end` 留空，改用下面这批字段：

```js
{
  id: 'moganshan',
  name: '莫干山 · 竹海 + 民国别墅群',
  type: 'trip',              // trip = 周边游
  venue: '浙江湖州 · 莫干山风景区',
  district: '浙江',           // 周边游用省份：浙江 / 江苏 / 安徽 / 江西 / 崇明
  address: '浙江省湖州市德清县莫干山镇',
  tripLen: '2d',             // day 当天往返 | 2d 两天一夜 | 3d 三天以上
  tripDays: '2天1夜',         // 卡片角标显示的文字
  distance: '上海自驾约 2.5h；高铁至德清站约 1h + 打车 30 min',
  bestSeason: '6-9 月避暑最佳；11 月看银杏',
  transport: '自驾最优；或高铁到德清站再打车',
  budget: '人均 400-800',
  itinerary: ['D1：庾村文化市集 → 芦花荡公园', 'D2：剑池 → 旭光台 → 返程'],
  price: { free: false, amount: '门票 + 景交 135 元', note: '纯门票 70 元' },
  booking: { required: false, level: 'none', realName: '…', channel: '…', steps: ['…'], tip: '…' },
  highlight: '看点一句话',
  tags: ['2天1夜', '避暑', '竹海'],
  rating: 5
}
```

**关键点**

- `tripLen` 是行程筛选的依据。选了「当天往返 / 2天1夜 / 3天以上」就等于只看周边游，市内项目会被自动排除。
- `distance` 会直接显示在卡片上，因为对周边游来说"要开多久车"比"什么时候结束"重要得多。
- 周边游的 `booking.channel` 写**买票渠道**（携程/美团/官方小程序），`steps` 写**订票与出行的坑**，不要写预约流程。
- `end` 留空即可，代码里 `isEnded()` 对 `trip` 直接返回 `false`，不会参与倒计时排序。

## 数据来源与免责

信息由各主办方官方渠道（上博 / 浦东美术馆 / PSA / 品牌小程序 / 区政府公告等）与公开报道整理，
`verifiedAt` 标注核对日期。**票价、展期、预约规则随时可能变，出行前请以官方最新公告为准。**

## 在线地址

👉 **https://naphjohn.github.io/weekend-go/**

## 部署

仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)`，保存即可。
（本仓库已按此配置，推送到 `main` 即自动重新发布。）

## 美食数据（data/food.js）

与 `activities.js` 分开，放「常年可去」的美食街 / 商圈 / 夜市，没有截止日期。

```js
{
  id: 'daxue-road',
  name: '大学路 · 创智天地',
  type: 'food',                  // 必须是 food
  venue: '大学路（淞沪路—智星路段）',
  district: '杨浦',
  metro: '江湾体育场',            // 对应 data/metro.js 里的站名，用于就近排序
  address: '杨浦区大学路，近淞沪路',
  start: '2026-01-01', end: '2099-12-31',
  hours: '多数 10:00-22:00，酒吧到凌晨',
  budget: '人均 60-120 元',
  best: '周末下午 + 晚上，露台区最舒服',
  must: ['各类 brunch / 咖啡', '沿街小酒馆'],
  booking: { required: false, level: 'none', channel: '直接去', steps: ['…'] },
  highlight: '…',
  tags: ['露台', '小酒馆'],
  rating: 5
}
```

## 按地点就近推荐（data/metro.js）

用户在页头输入地点（如「杨浦宁国路」），代码按四步定位到地铁站，再按直线距离排序：

1. 正好是地铁站名 → 直接用
2. `places` 词典命中（道路 / 商圈 / 景区 / 高校，取最长关键词）
3. 地铁站名部分匹配
4. 只输了区名 → `district` 里的区中心代表站

```js
stations: ['站名', x, y, '线路', '区']   // 人民广场为原点 (0,0)，x 东正 y 北正，1 单位 = 100 米
places:   ['地铁站', ['关键词1', '关键词2']]
district: { '杨浦': '五角场', … }
venue:    { '活动id': '最近地铁站' }      // 场馆位置固定，集中维护
```

- 坐标是**示意坐标，不是测绘数据**，只用于「谁近谁远」的粗排和路程档位（就在附近 / 很近 / 不远 / 跨区 / 较远）。
- 加新活动时在 `venue` 里补一条就能参与就近排序；不补也不影响其它功能。

## 评论 / 笔记

纯静态站没有后端，分两层：

- **我的笔记**：每张卡片下面可写，存 `localStorage`（key `weekendgo_notes_v1`），只在当前设备当前浏览器可见，底部面板可导出 JSON 备份。
- **全局讨论区**：走 Giscus（GitHub Discussions）。启用三步 —— 仓库 Settings 勾选 Discussions → giscus.app 授权拿 `repoId` / `categoryId` → 填进 `index.html` 的 `window.GISCUS_CFG` 并把 `enabled` 改成 `true`。
