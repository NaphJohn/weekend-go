/**
 * 数据文件：只改这里就能更新网站。
 * 字段说明见 README.md
 * verifiedAt: 2026-09-13
 */
window.ACTIVITIES = [
  /* ============ 展览 ============ */
  {
    id: 'world-tree',
    name: '世界树之巅：美洲古代文明大展',
    type: 'exhibition',
    venue: '上海博物馆人民广场馆 1-3 楼',
    district: '黄浦',
    address: '黄浦区人民大道 201 号（武胜路南门入馆）',
    start: '2026-07-09',
    end: '2027-11-14',
    closedDay: '周一闭馆（国定节假日除外）',
    hours: '以小程序当日场次为准',
    price: { free: false, amount: '148 / 135 / 74 元', note: '全价 148｜指定日 135（工作日）｜优惠 74｜亲子票 200/320' },
    booking: {
      required: true,
      level: 'hard',
      realName: '严格实名：购票填参观人实名信息，一人一票，每张证件每日限约 1 次，当日凭本人证件原件核验入馆',
      channel: '上海博物馆微信小程序 / 携程旅行 App',
      steps: [
        '打开「上海博物馆」微信小程序，提前录好参观人身份信息',
        '选择日期 + 场次，即约即售，先到先得',
        '每月 1 日 12:00 开放下一个月的票',
        '参观当日带本人有效证件原件'
      ],
      tip: '展期到 2027 年 11 月，完全不用抢。工作日买 135 元指定日票更划算、人更少。'
    },
    highlight: '上博人民广场馆建馆以来规模最大的展陈，近 3000 件文物，从奥尔梅克一路看到玛雅、阿兹特克、印加。建议留足半天。',
    tags: ['重磅', '文博', '要实名', '值得半天'],
    rating: 5
  },
  {
    id: 'chanel-19m',
    name: 'la Galerie du 19M SHANGHAI（香奈儿高级手工坊）',
    type: 'exhibition',
    venue: '浦东美术馆 3 层',
    district: '浦东',
    address: '浦东新区滨江大道 2777 号',
    start: '2026-09-25',
    end: '2026-11-15',
    closedDay: '以浦东美术馆公告为准',
    hours: '每日 10:00-21:00（最后入场 20:00）',
    price: { free: false, amount: '约 80 元起', note: '展览预约免费，但须另持当日浦东美术馆门票（80 元起）' },
    booking: {
      required: true,
      level: 'medium',
      realName: 'le19M 小程序预约需填姓名 + 手机号；浦美门票优惠票须持证核验',
      channel: '「le19M」微信公众号 / 小程序 + 「浦东美术馆」小程序',
      steps: [
        '关注「le19M」公众号 → 小程序免费预约展览场次（9/1 已开放）',
        '另在「浦东美术馆」小程序买当日门票（80 元起）',
        '浦东美术馆目前已取消日常参观预约，凭票入馆；人流高峰才会临时分时段预约'
      ],
      tip: '只展 52 天，中国大陆首站，巴黎 le19M 平时几乎不可达——稀缺性最高。但这是"讲工艺过程"的展，不是出片展，预期要调对。'
    },
    highlight: '香奈儿巴黎 le19M 高级手工坊首次来华。三大篇章：11 家手工坊装置、中法群展《触碰》、Lesage 刺绣坊百年回顾。',
    tags: ['限时 52 天', '时尚', '稀缺', '要预约'],
    rating: 5
  },
  {
    id: 'bulgari-kaleidos',
    name: 'BVLGARI「KALEIDOS 万花绮镜」珠宝特展',
    type: 'exhibition',
    venue: '上海当代艺术博物馆（PSA）',
    district: '黄浦',
    address: '黄浦区花园港路 200 号',
    start: '2026-09-05',
    end: '2026-10-31',
    closedDay: '周一闭馆（以 PSA 公告为准）',
    hours: '以 PSA 公告为准',
    price: { free: false, amount: '60 元', note: '早鸟 50｜学生教师凭证件半价｜未满 13 周岁免费｜部分人群免票' },
    booking: {
      required: true,
      level: 'medium',
      realName: '小程序预约需留姓名 + 手机号；半价票须现场出示学生证/教师证',
      channel: '「探索宝格丽」微信小程序',
      steps: [
        '微信搜索「探索宝格丽」小程序，预约并购票（60 元）',
        '现场 1 楼前台也可购买，半价票需现场出示证件',
        '⚠️ 部分攻略提到可能还需另购 PSA 门票，出发前在小程序确认'
      ],
      tip: '宝格丽在中国大陆规模最大的品牌展，1-1.5 小时能逛完，适合想轻松拍照的下午。'
    },
    highlight: '逾 300 件高级珠宝、古董典藏与私人收藏。三大篇章讲色彩。上海站特邀中国艺术家梁曼琪、张鼎参展，空间由 SANAA + Formafantasma 打造。',
    tags: ['珠宝', '好拍照', '要预约'],
    rating: 4
  },
  {
    id: 'jaeger-valley',
    name: '积家「匠艺之谷」限时主题空间',
    type: 'exhibition',
    venue: '张园 W4',
    district: '静安',
    address: '静安区茂名北路 188 弄（张园 W4）',
    start: '2026-09-10',
    end: '2026-09-23',
    closedDay: '展期内每日开放',
    hours: '每日 11:00-20:00',
    price: { free: true, amount: '免费', note: '' },
    booking: {
      required: false,
      level: 'easy',
      realName: '小程序预约填姓名 + 手机号；也可现场报名登记入场',
      channel: '「积家大工坊」微信小程序',
      steps: [
        '微信搜索「积家大工坊」小程序预约场次',
        '也可以直接去现场报名入场',
        '中央有大型冰雕装置，是主要打卡点'
      ],
      tip: '⚠️ 9 月 23 日就结束。在石库门里看瑞士制表，顺路逛张园很值，不值得单独特意跑。'
    },
    highlight: '全球首发 Hybris 系列、亚洲首秀 Reverso Enamel 珐琅腕表，制表师现场演示工艺，还有可动手的「精准先锋」工作坊。',
    tags: ['免费', '快结束了', '可现场报名', '制表'],
    rating: 4
  },
  {
    id: 'tong-yanfang',
    name: '金石永年——童衍方书法篆刻展',
    type: 'exhibition',
    venue: '程十发美术馆 1、2 号展厅',
    district: '长宁',
    address: '长宁区虹桥路 1398 号',
    start: '2026-09-12',
    end: '2026-10-11',
    closedDay: '周一闭馆（逢节假日正常开放）',
    hours: '10:00-18:00（17:00 停止入场）',
    price: { free: true, amount: '免费', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需实名，现场直接进',
      channel: '现场直接参与',
      steps: ['直接去，不用预约也不用买票'],
      tip: '免费、人少、冷气足。展品逾 200 件，含散氏盘、大盂鼎全形拓等珍贵拓本与题跋，金石爱好者会看得很过瘾。'
    },
    highlight: '西泠印社副社长童衍方八十岁汇报展。三大板块「与古为徒」「鉴古会今」「观云百象」，藏品 + 题跋 + 创作三位一体。',
    tags: ['免费', '不用预约', '人少', '书法篆刻'],
    rating: 4
  },
  {
    id: 'yulantang-boundless',
    name: '无边光景：玉兰堂（上海）新馆开幕展',
    type: 'exhibition',
    venue: '玉兰堂·上海',
    district: '静安',
    address: '静安区曲阜路 9 弄下沉庭院负一层 1 号（华侨城苏河湾）',
    start: '2026-08-15',
    end: '2026-09-30',
    closedDay: '周一闭馆',
    hours: '周二至周日 09:00-18:00',
    price: { free: true, amount: '免费', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需实名，直接进',
      channel: '现场直接参与（画廊）',
      steps: ['直接去，周二至周日 9:00-18:00', '咨询电话 021-56421899'],
      tip: '下沉式展厅闹中取静，迎面是瀑布般倾泻的大幅作品，视觉冲击强。苏河湾一带可以连着逛。'
    },
    highlight: '34 位艺术家 60 余件新作，何多苓、周春芽、尹朝阳等。展名取自朱熹「无边光景一时新」。',
    tags: ['免费', '不用预约', '当代艺术', '快结束了'],
    rating: 3
  },
  {
    id: 'dazu-stone',
    name: '须弥与芥子——大足石刻与守护人摄影艺术展',
    type: 'exhibition',
    venue: '言子书院',
    district: '奉贤',
    address: '奉贤区望园路 600 弄 97 号',
    start: '2026-09-05',
    end: '2026-10-23',
    closedDay: '周一闭馆',
    hours: '周二至周日 09:00-16:30（16:00 停止入场）',
    price: { free: true, amount: '免费', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需实名，免费免预约，直接前往',
      channel: '现场直接参与',
      steps: ['直接去，不用预约'],
      tip: '⚠️ 在奉贤，离市区远，建议专门安排半天。江南书院里看巴蜀石刻，反差感是看点。'
    },
    highlight: '大足石刻影像首次以完整规模登陆上海。100 余件大画幅摄影 + 手稿，分《须弥园》《芥子山》两大板块，拍了 200 多位民间守护人。',
    tags: ['免费', '不用预约', '摄影', '较远'],
    rating: 4
  },

  /* ============ 市集 / 节庆 ============ */
  {
    id: 'jingan-light',
    name: '第四届「闪亮·上海」静安国际光影展',
    type: 'event',
    venue: '南京西路商圈 · 静安公园 · 苏河湾 · 大宁',
    district: '静安',
    address: '南京西路商圈及静安公园、苏河湾商圈、大宁商圈',
    start: '2026-09-19',
    end: '2026-10-07',
    closedDay: '展期内每日',
    hours: '夜间为主',
    price: { free: true, amount: '免费', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需实名，户外展演直接看',
      channel: '现场参与',
      steps: ['直接去，晚上逛最合适'],
      tip: '免费、贯穿中秋国庆。首创城市中心「光影艺术公园」。配合南京西路夜景一起逛最舒服。'
    },
    highlight: '年度主题「光语更新」，南京西路首创光影艺术公园，苏河湾办国际光影艺术大赛，首次纳入大宁商圈。',
    tags: ['免费', '不用预约', '夜游', '中秋国庆'],
    rating: 4
  },
  {
    id: 'sh-light-festival',
    name: '第三届上海国际光影节',
    type: 'event',
    venue: '主会场黄浦延中绿地 / 苏州河滨水空间 + 全市 16 区',
    district: '黄浦',
    address: '主会场：黄浦区延中绿地、苏州河滨水空间',
    start: '2026-09-17',
    end: '2026-10-16',
    closedDay: '活动期内每日',
    hours: '夜间为主',
    price: { free: true, amount: '免费', note: '延中绿地装置与南广场市集免费开放；上海音乐厅建筑投影秀免费不免票' },
    booking: {
      required: false,
      level: 'medium',
      realName: '投影秀需实名制预约；户外装置与市集无需预约',
      channel: '飞猪旅行 App / 淘宝、支付宝飞猪小程序（搜「上海国际光影节」）',
      steps: [
        '户外光影装置、南广场市集：直接去，不用票',
        '上海音乐厅建筑投影秀：免费不免票，需实名预约',
        '在飞猪 App 或淘宝/支付宝飞猪小程序搜索「上海国际光影节」',
        '每个账号每日限约 1 场，最多 3 人；建议提前预填观演人'
      ],
      tip: '⚠️ 投影秀五轮放票：9/10、9/14、9/17、9/21、9/23 各中午 12:00。抢不到票也能逛延中绿地装置，别买黄牛票。'
    },
    highlight: '主题「光韵上海，影动世界」。158 场主题活动，1 个主会场 + 16 个分会场。音乐厅投影秀每晚 19:00/20:00/21:00。',
    tags: ['免费', '要抢票', '夜游', '国庆'],
    rating: 4
  },
  {
    id: 'av-festival',
    name: '2026 国际视听艺术嘉年华',
    type: 'event',
    venue: '静安区（核心活动落地上海展览中心）',
    district: '静安',
    address: '上海静安区',
    start: '2026-09-24',
    end: '2026-10-18',
    closedDay: '活动期内',
    hours: '以各场次公告为准',
    price: { free: true, amount: '多数免费', note: '部分专场活动可能需预约' },
    booking: {
      required: true,
      level: 'unknown',
      realName: '预约通道尚未上线，规则待公布',
      channel: '「静安文商旅体展联动平台」小程序（即将上线）',
      steps: [
        '⚠️ 截至 2026-09-13，公众预约通道尚未开放',
        '关注「静安文商旅体展联动平台」小程序，届时一码总览 + 预约报名'
      ],
      tip: '配套推出内置 NFC 芯片的定制手环，可一站式导览、预约报名、兑商户权益。9-10 月静安还会发「乐享嘉年华」消费券。'
    },
    highlight: '主题「声画之间·万物共生」。含国际视听艺术体验展、沉浸秀演、科技沙龙四大板块。苏河湾同步成为劳力士上海大师赛官方唯一「第二现场」。',
    tags: ['待开放预约', '科技艺术', '中秋'],
    rating: 3
  },
  {
    id: 'xintiandi-spain',
    name: '新天地西班牙风情节',
    type: 'market',
    venue: '上海新天地 马当路 & 自忠路沿街',
    district: '黄浦',
    address: '黄浦区马当路、自忠路沿街',
    start: '2026-09-11',
    end: '2026-09-13',
    closedDay: '仅三天',
    hours: '12:00-21:00',
    price: { free: true, amount: '免费入场', note: '酒饮 88 元任选 3 杯，餐饮单独消费' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需预约，直接去',
      channel: '现场参与',
      steps: ['直接去'],
      tip: '⚠️ 已结束（9/13 收官）。'
    },
    highlight: '百款西班牙美酒、5J 伊比利亚火腿、tapas、巴斯克蛋糕、弗拉明戈街头快闪。',
    tags: ['已结束', '美食', '免费入场'],
    rating: 4
  },
  {
    id: 'panglong-water',
    name: '蟠龙水市 · 水上集市与夜猫巷',
    type: 'market',
    venue: '蟠龙新天地 · 粮仓码头',
    district: '青浦',
    address: '青浦区蟠龙新天地粮仓码头',
    start: '2026-08-28',
    end: '2026-09-13',
    closedDay: '周五至周日及节假日',
    hours: '11:00-21:30',
    price: { free: true, amount: '免费入场', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需预约',
      channel: '现场参与',
      steps: ['直接去'],
      tip: '⚠️ 已结束（9/13 收官）。'
    },
    highlight: '摇橹船变身水上小摊，河道灯笼与烟雨廊桥光影秀，边逛边吃。',
    tags: ['已结束', '亲子', '免费'],
    rating: 4
  },
  {
    id: 'waibaojie-wine',
    name: '老外街葡萄酒节',
    type: 'market',
    venue: '老外街中央广场',
    district: '闵行',
    address: '闵行区虹梅路 3338 弄老外街中央广场',
    start: '2026-09-12',
    end: '2026-09-13',
    closedDay: '仅两天',
    hours: '15:00-21:00',
    price: { free: true, amount: '免费入场', note: '品酒课程、酒水消费另付' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需预约',
      channel: '现场参与',
      steps: ['直接去'],
      tip: '⚠️ 已结束（9/13 收官）。'
    },
    highlight: '百款新旧世界葡萄酒、专业品酒课程、潮流 DJ、手作与美食市集，护照集 18 个章换限定礼。',
    tags: ['已结束', '酒', '免费入场'],
    rating: 4
  },
  {
    id: 'shishang-pudong',
    name: '食尚浦东 · 亚洲风味季主题市集',
    type: 'market',
    venue: '新嘉中心 3 号门 1F 及 B1',
    district: '浦东',
    address: '浦东新嘉中心 3 号门一楼及 B1 层',
    start: '2026-09-11',
    end: '2026-09-13',
    closedDay: '仅三天',
    hours: '16:00-22:00',
    price: { free: true, amount: '免费', note: '餐饮单独消费' },
    booking: {
      required: true,
      level: 'easy',
      realName: '需预约，填手机号即可',
      channel: '大众点评搜索「食尚浦东市集」',
      steps: ['大众点评搜「食尚浦东市集」预约入场'],
      tip: '⚠️ 已结束（9/13 收官）。'
    },
    highlight: '40 家美食文化摊位，环球风味区 / 凉风小食局 / 丝路物华集三大分区，含糖画、香篆工坊等非遗体验。',
    tags: ['已结束', '美食', '要预约'],
    rating: 4
  },
  {
    id: 'solongpark',
    name: 'SoLongPark 次元市集（万象城九周年）',
    type: 'market',
    venue: '上海万象城',
    district: '闵行',
    address: '闵行区吴中路 1599 号',
    start: '2026-09-11',
    end: '2026-09-30',
    closedDay: '商场营业时间',
    hours: '以商场为准',
    price: { free: true, amount: '免费入场', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需预约',
      channel: '现场参与',
      steps: ['直接去'],
      tip: '周期长，不用赶。同期还有上海劳力士大师赛官方快闪全国首站（9/11-10/18）。'
    },
    highlight: '万象城九周年「So Long So 9ice」，漫威、米菲等 IP 集结，还有长沙人气零食金粒门上海首店。',
    tags: ['免费', '不用预约', 'IP', '周期长'],
    rating: 3
  },
  {
    id: 'tourism-festival',
    name: '上海旅游节花车分区巡展',
    type: 'event',
    venue: '全市 10 个区',
    district: '全市',
    address: '分散至全市各区（9/17 虹口今潮 8 弄、9/19 嘉定古猗园路等）',
    start: '2026-09-13',
    end: '2026-10-06',
    closedDay: '按各区排期',
    hours: '巡游多在傍晚至夜间',
    price: { free: true, amount: '免费观看', note: '' },
    booking: {
      required: false,
      level: 'none',
      realName: '无需预约，直接看',
      channel: '「上海旅游节」小程序查排期',
      steps: ['在「上海旅游节」小程序看当日巡游地点', '提前 30 分钟到沿线找位置'],
      tip: '第 37 届上海旅游节，21 辆主题花车 + 21 支表演方队。9 月 12 日外滩已办开幕巡游，接下来是各区分场。'
    },
    highlight: '21 支境内外表演方队与 21 辆主题花车，文博 IP 从展厅走向街头。',
    tags: ['免费', '不用预约', '亲子', '国庆'],
    rating: 3
  }
];

window.DATA_META = {
  verifiedAt: '2026-09-13',
  city: '上海',
  note: '信息由公开渠道整理，出行前请以各主办方官方最新公告为准。'
};
