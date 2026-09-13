# 周末去哪玩 · 上海

> 刷两小时小红书，不如让机器替你选。上海展览 · 市集 · 节庆清单，按剩余天数排序，一键决定这周末去哪。

一个给「周末不知道干嘛」用的静态决策站：把上海正在进行的展览、市集、节庆整理成结构化清单，
支持按 **免费 / 不用预约 / 区域 / 类型** 筛选，还有个 **「帮我选一个」** 的加权随机按钮。

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

## 数据来源与免责

信息由各主办方官方渠道（上博 / 浦东美术馆 / PSA / 品牌小程序 / 区政府公告等）与公开报道整理，
`verifiedAt` 标注核对日期。**票价、展期、预约规则随时可能变，出行前请以官方最新公告为准。**

## 在线地址

👉 **https://naphjohn.github.io/weekend-go/**

## 部署

仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)`，保存即可。
（本仓库已按此配置，推送到 `main` 即自动重新发布。）
