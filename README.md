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
