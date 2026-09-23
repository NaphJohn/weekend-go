# 周末去哪玩 · 上海

> 刷两小时小红书，不如让机器替你选。上海展览 · 市集 · 节庆 + 周边游清单，一键决定这周末去哪。

一个给「周末不知道干嘛」用的静态决策站：市内把上海正在进行的展览、市集、节庆整理成结构化清单，
市外加一层**周边游**（安吉、莫干山、舟山、千岛湖、黄山……从当天往返的穷游到三天两夜的远方），
支持按 **类型 / 免费 / 不用预约 / 区域 / 行程长度** 筛选，还有个 **「帮我选一个」** 的加权随机按钮。

两类数据的排序逻辑不同：**市内活动按剩余天数排**（快结束的在前，避免错过），
**周边游常年可去**，所以沉底并按推荐度排。

除首页外还有**六个**独立板块页，共用同一套 CSS 与原生的筛选 / 排序 / 「帮我选一个」交互：

| 板块 | 页面 | 数据 |
|---|---|---|
| 🎭 看剧 · 演出 | `shows.html` | `data/shows.js`（档期 / 场次 / 票价 / 购票渠道） |
| 🕵️ 剧本杀 | `scripts.html` | `data/scripts.js`（35 本：经典本 + 新本，人数/时长/难度/发行方式） |
| 🎲 桌游 · 狼人杀/阿瓦隆 | `boardgames.html` | `data/games.js`（30 款：要不要人主持 / 要不要买一盒；+ `GAMES_META.venues` 门店名单含最近地铁站、`freeHow/freeSpots` 免费玩法） |
| 📍 常年去处 | `venues.html` | `data/venues.js`（**57 处常设场馆**：博物馆 / 图书馆 / 公园 / 寺庙教堂 / 古镇 / 郊野 / 文艺街区，逐个核过门票、开放时间、闭馆日、预约要求） |
| 🍜 美食 · 按菜系 | `food.html` | `data/eats.js`（**140 家上榜餐厅**，14 个菜系，带大众点评公开评分 / 人均 / 榜单招牌菜 / 连续上榜年数；+ `EATS_META.honors` 米其林 & 黑珍珠名单、`scoreHow` 评分怎么读） |
| 🎪🚗 市内 · 周边游 | `index.html` | `data/activities.js` + `data/food.js` + `data/metro.js` |

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

## 桌游板块（`boardgames.html` + `data/games.js`）

第 5 个板块：**聚会桌游 / 桌上游戏选游戏参考**（不是排行榜）。数据在 `data/games.js`，页面是 `boardgames.html`，渲染引擎 `assets/games.js`。和剧本杀页是同级子板块 —— 两页顶部有 `.subtabs` 互跳，导航栏里各占一格。

```js
window.GAMES = [{
  id: 'avalon',                     // 唯一 id，同时是划词批注的锚点
  name: '阿瓦隆',
  en: 'The Resistance: Avalon',     // 英文名，卡片标题右侧小字；没有就写 '—'
  cat: 'social',                    // 主类型，用于筛选：social 社交推理 / party 欢乐破冰
                                    //   strategy 策略经营 | card 卡牌对战
  genres: ['身份推理', '阵营对抗'],   // 展示用类型标签
  players: '5–10 人（7–8 人最佳）',   // 展示文案
  pmin: 5, pmax: 10,                // 人数区间，用于「4 人以内 / 能开 6–8 人 / 9 人以上」
  duration: '约 30–50 分钟 / 局',
  dmin: 0.5, dmax: 0.85,            // 时长区间（**小时**），用于「半小时内 / 半小时–1.5 小时 / 1.5 小时以上」
  diff: 3,                          // 上手难度 1–5（1 一学就会、5 硬核）
  gm: 'none',                       // 'none' 不用人主持 | 'needed' 必须有人当主持（上帝 / 说书人）
  kit: 'buy',                       // 'buy' 要有一盒 | 'free' 不用买（扑克 / 纸笔 / 手机）
  year: '2012', designer: 'Don Eskridge / Indie Boards & Cards',
  highlight: '这游戏在玩什么（卡片展开区第一段）',
  forWho: '适合谁玩',
  note: '玩之前要知道 / 注意点',
  tags: ['不用主持', '无淘汰'],
  conf: 'high'                      // 'high' | 'mid'，mid 会在卡片上标「🟡 口径待核」
}];
window.GAMES_META = {
  verifiedAt: '2026-09-21', city: '上海', note: '…口径声明…',
  feeRef:   [{ k, v, d }],                              // 计费通行口径（非某家门店报价）
  platforms:[{ k, v, d, url }],                         // 线上平台外链（必须实测 200）
  venues:   [{ name, area, addr, metro, metroNote, price, hours, phone, note, conf, tags }],
  freeHow:  [{ k, v, d }],                              // 免费局的「怎么找」四个入口
  freeSpots:[{ k, v, d }],                              // 长期存在的免费 / 低价据点
  freeAlt:  ['…'],                                      // 不想花钱的替代打法（字符串数组）
  freeCare: ['…']                                       // 免费 / 低价专属防坑（字符串数组）
};
```

- 两个**最实用**的字段是 `gm` 和 `kit`：它们直接决定「今晚这一群人能不能开起来」。筛选芯片里专门给了「主持不限 / 不用人主持 / 需要有人主持」，卡片上也用徽章标出来。
- 其余筛选：类型 / 人数 / 时长 / 上手难度；排序：推荐排序（**= 数组收录顺序**，同类里越靠前越常被提起）/ 需要人数从少到多 / 时长从短到长 / 难度升降。
- 「帮我选一个」= 在当前筛选结果里按「不用人主持 + 不用买 + 半小时能打完」加权随机。
- **游戏数据纪律**：人数 / 时长一律取发行方 / 维基 / 公开桌游社区的通行口径。计费给两层 —— `feeRef` 是行业通行区间（按人头畅玩 / 按小时 / 包场 / 加个带玩的人），页面明确标「非某家门店报价」。`platforms` 里的外链必须是实测 200 的官网。

### 门店名单（`GAMES_META.venues`）—— 2026-09-21 新增

用户明确要「给店名 + 核地址和最近地铁站」，所以这里**是**写实名门店的，但用两层护栏：

1. **`conf` 分档**：`'high'` = 有百科词条 / 平台商家页可交叉（卡片右侧绿标「✅ 有词条 / 商家页」）；`'mid'` = 只有地图平台或聚合站收录（橙标「🟡 地址来自地图平台」）。页面顶部、卡片徽章、footer 三处都写明「出发前务必电话或地图 App 再核一次」。
2. **只写能核的字段**：`addr`（含门牌号）/ `metro`（写「X 号线 某某站」）/ `metroNote`（步行距离、换乘、其他备选站）。价格拿不准就写 `'—'`（`vLine()` 会跳过空行），**不要瞎填人均**。

- `vLine(k, val, lead)`：`val` 为空或 `'—'` 时整行不输出，所以缺字段是安全的，不会渲染出「🕐 营业 —」这种空壳。
- 渲染容器 `#venues`（`.venue-grid` + `.venue-card`），样式在 `style.css`「具体桌游吧卡片」段。
- ⚠️ **上海的「桌游吧推荐」搜索结果基本全是 AI SEO 稿**（`sina.cn/news/article/comos_*`、`k.sina.com.cn/article_*`，正文带「编辑部建议」「数据来源」+ FAQ 堆砌）。本次唯一可交叉的高置信来源是**百度百科「汇佳桌游咖啡徐汇旗舰店」词条 + 大众点评商家页（390 条评论）**。聚合站 `huodong.com/venue/detail/*` 页面模板高度雷同、地铁口径还互相矛盾（同一家店一处写「大木桥路站 500m」另一处写「上海体育场站 240m」）→ 归入 `'mid'`。

### 免费 / 最低价（`freeHow` / `freeSpots` / `freeAlt` / `freeCare`）

**关键设计：不列会过期的一场一场活动，而是给「怎么找」。**

- `freeHow` 四个入口按「稳不稳」排：上海市群众艺术馆「桌游月历」（一月一主题、公益、公众号报名，最稳的长期入口）→ 区街镇党群服务中心 / 社区文化活动中心（随申办 App + 各街镇公众号周公示）→ 活动行 / 大麦 / 区团委公众号 → 图书馆 / 高校桌游社。
- `freeSpots` 只放**机构类**据点（党群服务中心、社区咖啡屋、社区文化活动中心），不放「某年某月某场」。
- `freeAlt` 是不依赖任何活动的替代打法（自带游戏去共享空间 / 一副扑克 / 错峰进店 / 先凑人数再进店）。
- `freeCare` 是免费专属的三个坑（限名额要报名别放鸽子 / 免费局多是科普亲子轻策 / 社区存货少先电话问）。
- ⚠️ **别用表格装免费玩法** —— 条目长短差异大，`.free-list` 列表比表格好读；表格留给「选店避坑清单」那种等长的 8 条。

- 加完记得把四个 HTML 里 `?v=` 一起 +1，并确认 `index.html` 的 `.hud` 里 `#hk-games` 能取到 `window.GAMES.length`。

## 常年去处板块（`venues.html` + `data/venues.js`）—— 2026-09-22 新增

**它解决的是首页解决不了的场景**：首页回答「**这周末**有什么」（有档期、会结束），这一页回答
「**随便哪天**想去哪儿」（图书馆、常设博物馆、公园、古镇，全年都在）。两边内容零重合、也不互相替代 ——
改了 `activities.js` 不用管这里，反过来也一样。

- 57 条 = 博物馆·美术馆 14 / 图书馆·书院 9 / 公园 13 / 寺庙·教堂 7 / 古镇·老街 6 / 登山·郊野 2 / 文艺街区 6
  （其中 47 条免费、31 条 `conf:'high'`）。接入页 `venues.html`，渲染层 `assets/venues.js`。
- 卡片类名 `.card-venue`（配色走青绿，见 `style.css` 的「常年去处页」小节），页内用 `.facts / .fact`
  四行固定展示 **门票 / 开放 / 闭馆 / 入馆** —— 这四个字段就是这一页存在的理由，别精简掉。

### 字段口径（`window.VENUES[]`）

```js
{
  id, name, cat,           // cat: museum|library|park|temple|town|hill|street
  district, addr,
  metro,                   // ⚠️ 必须是用距离排序时认识的站名，且要在 data/metro.js 的 stations 里存在
  metroNote,               // 显示的交通文案（可以写得比 metro 更细，比如「出站步行 10 分钟」）
  free,                    // true = 常态免费；false = 常态收费
  fee, hours, closed, book,
  tip, conf                // 'high' | 'mid'
}
```

### 五条硬规矩（这个板块比别的板块更容易写错）

1. **`free` 说的是「能不能免费进」，不是「好不好」。** 上海自然博物馆 ¥30、上海科技馆 ¥45、
   昆虫博物馆 ¥15 都被标成 `free:false` —— 它们不值得被排除，只是不该被写成免费。
2. **`closed` 必须区分「整天闭馆」和「只上午闭馆」。** 博物馆/美术馆多数是**周一整天闭**；
   公共图书馆多数是**周一 13:00（或 13:30）才开**。网上把它们统一写成「周一闭馆」是最大的坑，
   所以 `venues.html` 里「不白跑的五条」第一条专讲这件事。
3. **`hours` 拿不准就写 `'—'`**，渲染层会显示「以馆方公告为准」，绝不编一个看起来合理的数字。
4. **门票口径一律写行业通行价，不写平台券后价**（上海科技馆平台上的 168/198 是「门票 + XR / 研学」套餐，
   纯门票 ¥45，卡片的 `tip` 里专门点了一句）。
5. **`VENUES_META.notFree` 是这一页最有价值的一块**，别当装饰。它列的是「被当成免费的收费场馆」：
   震旦博物馆 ¥48、上博人民广场馆大展期间 ¥148、顾村公园 ¥20、古镇园中园（古猗园 ¥12 / 檀园 ¥18 /
   朱家角联票 ¥60 / 枫泾通票 ¥42）、西岸·龙·油罐·宝龙·外滩美术馆一批、上话「公益场」其实是 ¥50/¥80 票、
   以及查不到对应馆的「朵云轩艺术图书馆」。加场馆时如果发现新的「伪免费」，往这里加。

### 定位 / 距离排序

- 复用 `assets/locate.js` 的 `window.WG`（和首页共用 `weekend-go_loc_v1`，首页填过这里就认）。
- 场馆 → 站的解析在 `assets/venues.js` 的 `stationOf()`：先看 `v.metro`，认不出再退回 `METRO.district[区]`。
- `data/metro.js` 为此**新增了 2 个站**（`白银路`、`安亭`）和一批**场馆别名**（`昆虫博物馆 → 东安路`、
  `和平书院 → 鞍山新村`、`大来时间博物馆 → 安亭`…）。⚠️ `locate()` 会先剥掉开头的「上海」，
  所以别名要写**剥完之后的形态**（写 `昆虫博物馆`，不要写 `上海昆虫博物馆`）。
- 没有地铁的条目（枫泾古镇、跨区美术馆清单、2026 新开公园）`metro` 留空字符串，距离排序会自动兜到区中心。

### 加完记得

- 五个 HTML 的 `?v=` 一起 +1；`index.html` 的 `.hud` 数量别名 `#hk-venues` 要能取到 `window.VENUES.length`；
  四页 `.nav`（+ 剧本杀/桌游页的 `.subtabs`）都要有 `venues.html` 的入口。
- ⚠️ `.hud` 的栅格是**算出来的常量**：**7 块时 `minmax` 必须是 `240px`**（容器约 1050px，gap 14px；
  `n*m+(n-1)*14 ≤ 1050` → 199–252px 之间才是 4 列，7 块正好 4+3；`260px` 会掉成 3 列 →
  变成「3+3+1 只孤儿」；`190px` 又会排 5 列）。见 `style.css` 顶部注释，加板块数时回去重算。

## 美食板块（`food.html` + `data/eats.js`）—— 2026-09-23 新增

第 6 个板块：**按菜系挑具体一家店**（不是排行榜、也不给门店排名）。页面是 `food.html`，
数据在 `data/eats.js`，渲染引擎 `assets/eats.js`。

### 和首页「美食」的分工（别混）

- **首页 `data/food.js`** = 美食**街 / 商圈**（云南南路、黄河路、虹泉路…），回答「去哪一片逛吃」，不绑具体店。
- **这一页 `data/eats.js`** = **具体一家店**，回答「今晚吃哪一家」，带评分 / 人均 / 招牌菜 / 上榜年数。
- 两页顶部有 `.subtabs` 互跳；首页 `.hud` 有独立入口块。

### 字段（`window.EATS[]`）

```js
{ id, name, cuisine,        // cuisine = 14 个菜系之一，供筛选
  cat,                      // 大众点评的原始品类（如 `日式烧烤/烤肉`），原文照录
  score, price,             // 平台公开评分 / 人均（榜单页展示值）
  area,                     // 商圈（如 `淮海路`、`龙华/西岸`）
  metro, district,          // 最近地铁站（可选）/ 行政区兜底
  must,                     // 榜单页展示的「N 人推荐」招牌菜
  reason,                   // 榜单页的上榜理由原文
  includeYear, rankYear, rankText }
```

`EATS_META`：`verifiedAt` / `scoreDate` / `note` / `howTo` / **`cuisineGuide`（14 个菜系：去哪片 / 怎么点 / 注意什么）**
/ **`scoreHow`（评分怎么读、差评怎么看、怎么判断刷分）** / `care` / **`honors`（米其林 & 黑珍珠名单）**。

### 数据来源（全部公开可核，不接受二手转述）

| 数据 | 来源 | 走哪个字段 |
|---|---|---|
| 评分 / 人均 / 招牌菜 / 收录年数 / 连续上榜年数 | 大众点评「2026 必吃榜」**官方榜单页**（`plat.dianping.com/app/femember-musteat-web/musteat-rank`，`cityid=1` 上海） | `EATS` |
| 米其林星级 / 必比登 | **《2026 沪苏浙米其林指南》官方榜单**（`guide.michelin.com` 上海页，带官方法文菜系标注） | `EATS_META.honors` |
| 黑珍珠钻级 | **2026 黑珍珠餐厅指南**官方发布 | `EATS_META.honors` |

### ⚠️ 抓取这几个坑（下次更新数据直接照抄）

1. **`cityid` 必须传 `1` 才是上海**；不传会被 IP 定位到别的城市（本次默认落到汉中）。
   校验方法：抓完看店名，出现「浙江中路店 / 肇嘉浜店」这类才是上海。
2. **那个接口每次返回的是「随机 10 条」，分页参数无效**（`pageNo` / `page` / `offset` 全被忽略，
   不同参数返回不同随机样本）。所以拿全量的唯一办法是**重复抽样取并集**：
   本次抽 80 次拿到 **140 / 160** 家（`P(漏) = 0.9375^80 ≈ 0.6%`）。⚠️ 别指望「翻到第 16 页」。
3. **店名 / 评分 / 人均都嵌在 HTML 里的内联 JSON**（`"shopName"` / `"fiveScore"` / `"price"` /
   `"mainCategoryName"` / `"shopTags"` / `"includeYear"` / `"inRankYear"`），
   用「`{` 大括号配平」定位每条对象再逐个抠字段即可，不需要 headless 浏览器。
4. **`inRankYearText`（如「连续 8 年上榜」/「2026年新上榜」）和 `inRankYear` 是自洽的**，
   直接当「连续上榜年数」用；`includeYear` 是「收录年数」，两个字段**别混**（前者防刷分，后者看老店）。
5. 菜品字段 `shopTags` 里是 `78人推荐"总统牛肉"` 这种，要正则剥掉人数与引号。

### 数据诚信：为什么**不抄「美团 4.6 分」**

评分每天都在动，抄进静态页两周就错；而且不给对照点，「4.6」本身没有意义。所以页面走三件事：
① 只收**榜单页当天的公开数字**并标死 `scoreDate`；② 给**对照区间**（必吃榜池子里普遍 4.1–4.9，
4.5 属正常、4.7+ 才突出）；③ 用 `EATS_META.scoreHow` 教**怎么读差评、怎么判断刷分** ——
其中「收录年数 + 连续上榜年数」两个字段是防刷分最有效的，因为刷不出来。
**❌ 不要把搜索结果里的评分当事实写进 `EATS`**（这类页面十有八九是 AI 生成的 SEO 稿）。

### 菜系归类

`cat`（大众点评 55 种原始品类）→ `cuisine`（14 个）：

`benbang 本帮·上海菜` / `jiangzhe 江浙·杭帮·淮扬` / `yue 粤菜·潮汕` / `chuan 川菜` /
`xiang 湘菜·湖南` / `huoguo 火锅·锅物` / `riliao 日料` / `kaorou 烤肉·烧烤` / `hancan 韩餐` /
`dongnanya 东南亚菜` / `xican 西餐` / `miandian 面点·小吃` / `vegetarian 素食·斋菜` / `qita 其他各地菜`

⚠️ **每个菜系都要 ≥3 家才配得上一个筛选芯片**（点下去只剩 1 条比没有还难看）。
`assets/eats.js` 里对计数为 0 的芯片会直接 `display:none`，但**归类时就该先跑一遍分布**。

### 地名 → 地铁站（距离排序）

商圈名（`淮海路` / `龙华/西岸` / `陆家嘴商圈`）跟站名对不上，三级兜底：

1. 站名子串命中（`陆家嘴商圈` → `陆家嘴`）：取**最长**匹配，避免被短站名抢走；
2. 别名表 `AREA_STATION`（`淮海路` → `淮海中路`、`虹桥/古北` → `伊犁路`…）：**别名目标必须是 `data/metro.js` 里真有的站**；
3. 行政区兜底 `AREA_DISTRICT`（`三林地区` → 浦东）。

本次 140 家里 **120 家**能算出精确距离，其余 20 家靠区中心兜底。⚠️ 加了别名要跑
`node --check` 之外还得校验站名存在，否则距离会静默变 `null`。

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

子页：[/shows.html](https://naphjohn.github.io/weekend-go/shows.html) · [/scripts.html](https://naphjohn.github.io/weekend-go/scripts.html) · [/boardgames.html](https://naphjohn.github.io/weekend-go/boardgames.html) · [/venues.html](https://naphjohn.github.io/weekend-go/venues.html) · [/food.html](https://naphjohn.github.io/weekend-go/food.html)

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
