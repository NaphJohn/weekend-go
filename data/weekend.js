/* 本周推荐（2026-11-12 建）
 * 用法：window.WEEKEND = [ ... ]，由 assets/weekend.js 渲染到 index.html 的 #weekBox。
 * 字段约定：
 *   id            唯一键
 *   pick          true = 主推（大卡）；false = 顺路可加（小行）
 *   cat           exhibition | show | market | pet
 *   name          活动名
 *   dateText      人读的日期文案（'11/14–11/15'）
 *   sessions      场次 / 时段原文（多场次逐条写）
 *   place         场地名
 *   addr          地址
 *   metro         最近地铁（拿不准写 '—'，绝不编）
 *   why           亮点（为什么值得去）
 *   book          预约方式 + 价格（含"免费·无需预约"这类明确结论）
 *   free          是否免费进场
 *   needBooking   是否必须预约
 *   tip           避坑 / 提醒（可为空）
 *   start / end   'YYYY-MM-DD'，end 过期后自动隐藏
 *   src           [{ t: 来源名, u: 链接 }]
 */
window.WEEKEND = [
  {
    id: 'westbund-2026',
    pick: true,
    cat: 'exhibition',
    name: '西岸艺术与设计博览会',
    dateText: '11/12–11/15（公众日）',
    sessions: '公众日 11/12–11/15；VIP 预展 11/10–11/11。西岸漩心 ORBIT 11/14–15 延至 19:00。闭馆前一小时停止入场。',
    place: '西岸四馆联动',
    addr: '西岸国际会展中心（龙耀路 7 号）／西岸艺术中心（龙腾大道 2555 号）／GATE M 西岸梦中心-梦工场（龙腾大道 2266 号 8 栋）／西岸漩心 ORBIT（龙腾大道 3299 号）',
    metro: '11 号线云锦路',
    why: '一年一度、上海秋季最集中的当代艺术现场。四馆分散但都在龙腾大道一带，一张票走完要留足 4 小时以上；画廊阵容以国际一线为主，适合"看真迹"而不是"打卡拍照"。',
    book: '官方微信公众号购票（分单日票 / 通票），现场也可买但周末排队久。建议先买 11/14 或 11/15 单日票，早场人少。',
    free: false,
    needBooking: true,
    tip: '四馆之间步行 10–20 分钟，穿能走路的鞋；闭馆前一小时停止入场，下午 4 点后到只够看一馆。',
    start: '2026-11-12',
    end: '2026-11-15',
    src: [
      { t: '西岸艺博会官方公众号·参观指南', u: 'https://mp.weixin.qq.com/' }
    ]
  },
  {
    id: 'changan-24h',
    pick: true,
    cat: 'show',
    name: '音乐剧《长安十二时辰》',
    dateText: '11/13–11/15（三场）',
    sessions: '11/13（五）19:30 · 11/14（六）19:30 · 11/15（日）14:00',
    place: '黄浦文化中心 · 大上海剧场',
    addr: '黄浦文化中心 大上海剧场（以票面地址为准）',
    metro: '—',
    why: '缪时客出品，长三角城市戏剧季专属 85 折。马伯庸原著改编，舞台调度和"长安城十二时辰"的时间压力做得很实，是这两年国产音乐剧里少见的正剧路子。',
    book: '大麦 / 长三角城市戏剧季专区购票，选「85 折」档。周日下午场最适合当天往返。',
    free: false,
    needBooking: true,
    tip: '85 折是戏剧季专属档，不是所有渠道都有；买前对一下票面场次，三场里 11/15 14:00 最便宜也最快满。',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [
      { t: '大麦·演出详情', u: 'https://www.damai.cn/' }
    ]
  },
  {
    id: 'tang-market',
    pick: true,
    cat: 'market',
    name: '唐风市集（《长安十二时辰》场外）',
    dateText: '11/13–11/15',
    sessions: '11/13（五）14:00–20:00 · 11/14（六）14:00–20:00 · 11/15（日）11:00–18:00',
    place: '剧场户外广场',
    addr: '黄浦文化中心 户外广场（与剧场同址）',
    metro: '—',
    why: '不用买票就能进。玩法是「集印卡 + 6 枚印章」（子／寅／卯／辰／巳／午），集齐换礼；汉服、投壶、香囊这类摊位密度高，拍照氛围比多数商场市集扎实。',
    book: '免费 · 无需预约，直接进。集印卡现场领，海报每场限 200 份，早到才有。',
    free: true,
    needBooking: false,
    tip: '想拿海报就 14:00 准点到；周日 11:00 开市但 18:00 收，比周五周六短两小时。',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [
      { t: '黄浦文化中心·活动公告', u: 'https://mp.weixin.qq.com/' }
    ]
  },
  {
    id: 'psa-liujiakun',
    pick: true,
    cat: 'exhibition',
    name: '刘家琨：月亮与井（PSA）',
    dateText: '11/14 开展',
    sessions: '2026/11/14–2027/2/28；11:00–19:00（18:00 停止入场，周一闭馆）',
    place: '上海当代艺术博物馆 PSA · 7 楼 + 5 楼露台',
    addr: '黄浦区苗江路 678 号',
    metro: '4 / 8 号线西藏南路',
    why: '普利兹克奖得主刘家琨的首次机构大型个展，占了 PSA 7 楼整层加 5 楼露台 —— 建筑师的展看模型和图纸比看成品更有意思，露台部分还能看江。',
    book: 'PSA 官方小程序购票。早鸟 ¥50 只到 11/13，11/14 起恢复原价 ¥60 —— 想省钱就 11/13 之前先把票买了、周末再去看。',
    free: false,
    needBooking: true,
    tip: '早鸟票是按购买时间算、不按参观时间算，所以周五前下单就行；周一闭馆别扑空。',
    start: '2026-11-14',
    end: '2027-02-28',
    src: [
      { t: 'PSA 官方展讯', u: 'https://www.powerstationofart.com/whats-on/exhibitions/liu-jiakun-the-moon-and-the-well' }
    ]
  },
  {
    id: 'map-19m',
    pick: true,
    cat: 'exhibition',
    name: '香奈儿 la Galerie du 19M SHANGHAI（浦东美术馆）',
    dateText: '至 11/15（闭馆前最后一波）',
    sessions: '2026/9/25–11/15，浦东美术馆 3F。⚠️ 浦美 11/16 起临时闭馆，这是最后一周。',
    place: '浦东美术馆 3F',
    addr: '浦东新区滨江大道 2777 号',
    metro: '2 号线陆家嘴',
    why: 'le19M 是香奈儿把 Métiers d\'art（ Métiers d\'Art 手工坊群）搬到上海的实体展，刺绣、羽饰、金箔这些手艺是能凑近看的实物，不是影像。同期馆内还有卡罗莱娜·凯塞多「鲸鱼的致敬」（至 2027/2/21）、「所念，所梦」（至 11/14）、多邻国集章（至 11/15），一张票全包。',
    book: '两步都要做：① le19M 官方小程序预约 19M 展区时段 ② 另买浦东美术馆门票（一票通馆）。入馆后凭预约记录领手环。',
    free: false,
    needBooking: true,
    tip: '11/16 起整馆临时闭馆，别拖到下周末；「所念，所梦」11/14 就结束，想看得排在周六。',
    start: '2026-09-25',
    end: '2026-11-15',
    src: [
      { t: '浦东美术馆·展讯', u: 'https://www.museumofartpd.org.cn/' },
      { t: 'le19M 官方小程序', u: 'https://mp.weixin.qq.com/' }
    ]
  },
  {
    id: 'pet-carnival',
    pick: true,
    cat: 'pet',
    name: '陆家嘴宠物文化嘉年华',
    dateText: '11/14–11/15',
    sessions: '周六 14:00 狗狗沟通技巧 · 14:30 汉维宠仕沙龙 · 15:00–15:40 掌上明珠人宠风尚秀 · 16:00–19:00 乐队；周日 14:00 MayHo 宠物艺术 · 14:30 新瑞鹏沙龙 · 15:00–15:40 风尚秀',
    place: '上海国际会议中心 · 东方滨江大酒店 户外草坪',
    addr: '浦东新区滨江大道 2727 号',
    metro: '2 号线陆家嘴',
    why: '免费，且是户外草坪不是商场中庭。四大体验区：气味图书馆 / 照相馆 / 互动玩乐园 / 文明养宠俱乐部。带狗来能放开跑，不带狗来纯看也够一下午 —— 人宠风尚秀和乐队是这场的两个看点。',
    book: '免费 · 无需预约。带犬需备疫苗本 + 狗证，全程牵绳。',
    free: true,
    needBooking: false,
    tip: '活动主体在 14:00 之后，上午去是空的；主办为陆家嘴金融城文化中心 + 抖音生活服务，现场可能有人流管控。',
    start: '2026-11-14',
    end: '2026-11-15',
    src: [
      { t: '陆家嘴金融城文化中心·活动公告', u: 'https://mp.weixin.qq.com/' }
    ]
  },

  /* ---------- 顺路可加（不单独跑一趟，路过顺便） ---------- */
  {
    id: 'breadful-days',
    pick: false,
    cat: 'market',
    name: '有有市集 Breadful Days',
    dateText: '11/13–11/15',
    sessions: '11:00–19:00',
    place: '外滩源 · 圆明园路步行街',
    addr: '黄浦区圆明园路步行街',
    metro: '2 / 10 号线南京东路',
    why: '75 家烘焙品牌、其中 25 家首次进上海。外滩源步行街本身就适合散步，市集只是加分项。',
    book: '早鸟 ¥38（含限定周边）/ 正价 ¥48。携程搜「有有市集」购票。',
    free: false,
    needBooking: true,
    tip: '早鸟要提前买；正价现场也能进。',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [{ t: '携程·有有市集', u: 'https://www.ctrip.com/' }]
  },
  {
    id: 'century-park-autumn',
    pick: false,
    cat: 'market',
    name: '世纪公园 · 金秋游园',
    dateText: '至 11/15',
    sessions: '公园开放时间内',
    place: '世纪公园',
    addr: '浦东新区锦绣路 1001 号',
    metro: '2 号线上海科技馆 / 7 号线花木路',
    why: '银杏和地肤的最后一周，公园本身免费。',
    book: '公园免费进，园内项目另计。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-01',
    end: '2026-11-15',
    src: [{ t: '世纪公园', u: 'https://www.centurypark.com.cn/' }]
  },
  {
    id: 'luyue-bread',
    pick: false,
    cat: 'market',
    name: '陆悦天地「一起发酵吧！面包文化节」',
    dateText: '11/13–11/15',
    sessions: '商场营业时间内',
    place: '陆悦天地',
    addr: '浦东新区（以商场公告为准）',
    metro: '—',
    why: '免费面包市集，和 Breadful Days 撞题材但不用买票，二选一预算友好。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [{ t: '陆悦天地·活动公告', u: 'https://mp.weixin.qq.com/' }]
  },
  {
    id: 'hopson-bread',
    pick: false,
    cat: 'market',
    name: '五角场合生汇「了不起的面包节」',
    dateText: '11/11–11/15',
    sessions: '商场营业时间内',
    place: '五角场合生汇',
    addr: '杨浦区淞沪路 77 号',
    metro: '10 号线江湾体育场',
    why: '杨浦一侧唯一的面包主题市集，免费，住在东北片就不用跑外滩源。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-11',
    end: '2026-11-15',
    src: [{ t: '合生汇·活动公告', u: 'https://mp.weixin.qq.com/' }]
  },
  {
    id: 'wuyi-jiang',
    pick: false,
    cat: 'market',
    name: '武夷 MIX320「就酱生活节」',
    dateText: '11/13–11/15',
    sessions: '园区开放时间内',
    place: '武夷 MIX320',
    addr: '长宁区武夷路 320 号',
    metro: '2 / 11 号线江苏路',
    why: '免费，园区本身就是改造过的老厂房街区，逛市集顺带看建筑。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [{ t: '武夷 MIX320·活动公告', u: 'https://mp.weixin.qq.com/' }]
  },
  {
    id: 'luxun-farmers',
    pick: false,
    cat: 'market',
    name: '鲁迅公园 · 农夫集市',
    dateText: '11/04–11/15',
    sessions: '白天',
    place: '鲁迅公园',
    addr: '虹口区四川北路 2288 号',
    metro: '3 / 8 号线虹口足球场',
    why: '免费，本地农户直供，买菜顺便逛公园。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-04',
    end: '2026-11-15',
    src: [{ t: '鲁迅公园', u: 'https://www.sh-luxunpark.com/' }]
  },
  {
    id: 'yuyuan-forest',
    pick: false,
    cat: 'market',
    name: '愚园部落 · 森林市集',
    dateText: '11/12–11/15',
    sessions: '街区开放时间内',
    place: '愚园路街区',
    addr: '长宁区愚园路',
    metro: '2 / 11 号线江苏路',
    why: '愚园路本来就好逛，市集只是把人往弄堂里带。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-12',
    end: '2026-11-15',
    src: [{ t: '愚园路街区·活动公告', u: 'https://mp.weixin.qq.com/' }]
  },
  {
    id: 'changfeng-notebook',
    pick: false,
    cat: 'market',
    name: '长风大悦城「风向岛手账市集」',
    dateText: '11/13–11/15',
    sessions: '商场营业时间内',
    place: '长风大悦城',
    addr: '普陀区大渡河路 196 号',
    metro: '13 号线大渡河路',
    why: '手账 / 文具 / 贴纸同好向，免费。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [{ t: '长风大悦城·活动公告', u: 'https://mp.weixin.qq.com/' }]
  },
  {
    id: 'expoland-ip',
    pick: false,
    cat: 'market',
    name: '世博展览馆「有空见 IP 艺术市集」',
    dateText: '11/13–11/15',
    sessions: '展馆开放时间内',
    place: '上海世博展览馆',
    addr: '浦东新区博成路 850 号',
    metro: '7 / 8 号线耀华路',
    why: 'IP 周边 / 潮玩向，和西岸同一天可以串（都在浦东→徐汇一线）。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [{ t: '上海世博展览馆·展讯', u: 'https://www.shexpo.com.cn/' }]
  },
  {
    id: 'silver-toy',
    pick: false,
    cat: 'market',
    name: '银盐复古玩具展 2.0',
    dateText: '11/12–11/15',
    sessions: '以主办公告为准',
    place: '淮海中路 550 号',
    addr: '黄浦区淮海中路 550 号',
    metro: '1 / 10 / 12 号线陕西南路',
    why: '复古玩具 / 铁皮 / 老广告牌，逛完正好接淮海路。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-12',
    end: '2026-11-15',
    src: [{ t: '主办公告', u: 'https://mp.weixin.qq.com/' }]
  },
  {
    id: 'succulent-show',
    pick: false,
    cat: 'market',
    name: '上海秋季多肉植物展',
    dateText: '11/13–11/15',
    sessions: '白天',
    place: '瑞虹新天地',
    addr: '虹口区瑞虹路 181 号',
    metro: '8 号线虹口足球场 / 10 号线邮电新村',
    why: '多肉玩家年度聚会，免费看，顺带逛瑞虹。',
    book: '免费 · 无需预约。',
    free: true,
    needBooking: false,
    tip: '',
    start: '2026-11-13',
    end: '2026-11-15',
    src: [{ t: '主办公告', u: 'https://mp.weixin.qq.com/' }]
  }
];

window.WEEKEND_META = {
  updatedAt: '2026-11-26',
  range: { sat: '2026-11-28', sun: '2026-11-29' },
  verifiedAt: '2026-11-12',
  title: '本周推荐',
  intro: '按「这周末两天能去」筛的，不追求全，只收还在办、且值得专门跑一趟的。主推 6 条按「一天的完整动线」标准挑；顺路可加是不用单独跑一趟的补充。',
  howTo: [
    '主推的 6 条里，有 3 条是免费的（唐风市集 / 宠物嘉年华 / 世纪公园），预算紧就只挑这几条。',
    '一天塞两条主推比较合理：上午一个展 + 下午一个市集，别一天排三馆（西岸四馆之间步行 10–20 分钟，很吃体力）。',
    '要买票的（西岸 / 长安十二时辰 / PSA / 19M / 有有市集）周末现场排队都长，能提前买就提前买。'
  ],
  staleHint: '本板块由自动化每周四晚更新一次。看到这条说明本周数据还没刷新，出行前请以官方公告为准。',
  care: [
    '⚠️ 展期 / 票价 / 预约规则随时可能调整，本页只是「值得去」的线索，不售票、也不构成官方承诺。',
    '⚠️ 免费活动的时段最容易被改（尤其户外市集，下雨会取消）—— 出门前刷一眼主办方公众号。',
    '⚠️ 「闭馆前一小时停止入场」是上海多数美术馆的通行规矩，下午四点后到基本只够看一层。'
  ],
  updater: 'WorkBuddy 每周四 20:00 自动更新 + 邮件通知'
};
