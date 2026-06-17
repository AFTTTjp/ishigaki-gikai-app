export type SessionCategory = {
  title: string;
  description: string;
  billNumbers: string[];
};

export type SessionScheduleItem = {
  label: string;
  dates: string;
  note?: string;
};

export type SessionOverviewData = {
  summary: string;
  categories: SessionCategory[];
  /** トップページでの表示件数上限。省略時は全件表示 */
  topPageCount?: number;
  schedule: SessionScheduleItem[];
  officialUrl: string;
};

export const SESSION_OVERVIEWS: Record<string, SessionOverviewData> = {
  "ishigaki-r8-dai4-teireikai": {
    summary:
      "令和8年第4回石垣市議会定例会では、宿泊税の使い道に関わる基金条例、火葬場への指定管理者制度の導入、母子・父子家庭等の医療費助成、下水道の災害時復旧や市営住宅の子育て世帯支援に関する条例改正、一般会計補正予算などが審査されます。\n\nまた、学校で使うGIGA端末、救助工作車、高規格救急自動車の取得、基隆市との国際友好都市提携、サンゴレンジャープラスの石垣市事業化を求める請願なども扱われます。",
    topPageCount: 7,
    categories: [
      {
        title: "宿泊税・観光",
        description: "宿泊税を財源とした基金の設置条例が審査されます。",
        billNumbers: ["議案第36号"],
      },
      {
        title: "火葬場・暮らしのインフラ",
        description:
          "市の火葬場に指定管理者制度を導入するための設置・管理に関する条例が審査されます。",
        billNumbers: ["議案第37号"],
      },
      {
        title: "子育て・医療費助成",
        description:
          "母子・父子家庭等を対象とした医療費助成制度の一部改正が審査されます。",
        billNumbers: ["議案第38号"],
      },
      {
        title: "下水道・災害時の復旧",
        description:
          "災害など非常時に、他市町村が指定した工事店でも下水道の復旧工事を行えるようにする条例の一部改正が審査されます。",
        billNumbers: ["議案第39号"],
      },
      {
        title: "市営住宅・子育て世帯支援",
        description:
          "子育て世帯向けの期限付き入居制度の新設や、入居選考への点数評価方式の導入を含む市営住宅条例の一部改正が審査されます。",
        billNumbers: ["議案第40号"],
      },
      {
        title: "奨学基金",
        description:
          "桃原用昇奨学基金・同高等学校奨学基金を新財団へ継承するための特例並びに廃止に関する条例が審査されます。",
        billNumbers: ["議案第41号"],
      },
      {
        title: "一般会計補正予算",
        description: "令和8年度の一般会計を補正する予算案が審査されます。",
        billNumbers: ["議案第42号"],
      },
      {
        title: "基隆市との友好都市提携",
        description:
          "中華民国基隆市との国際友好都市提携に関する議案が審査されます。",
        billNumbers: ["議案第45号"],
      },
      {
        title: "学校端末・消防救急車両の取得",
        description:
          "GIGA端末・救助工作車・高規格救急自動車など、財産取得に関する議案が審査されます。",
        billNumbers: ["議案第48号", "議案第49号", "議案第50号", "議案第51号"],
      },
      {
        title: "ハラスメント第三者委員会",
        description:
          "ハラスメント調査のための第三者委員会の委員報酬を見直す条例の一部改正が審査されます。",
        billNumbers: ["議案第52号"],
      },
      {
        title: "サンゴレンジャープラス請願",
        description:
          "サンゴレンジャープラスの石垣市事業化を求める請願が委員会に付託されています。",
        billNumbers: ["請願第2号"],
      },
    ],
    schedule: [
      { label: "開会", dates: "6月8日（月）" },
      {
        label: "一般質問",
        dates: "6月15日〜22日",
        note: "通告締切：6月10日正午",
      },
      { label: "委員長報告・採決", dates: "6月24日（水）" },
      { label: "閉会", dates: "6月24日（水）" },
    ],
    officialUrl:
      "https://www.city.ishigaki.okinawa.jp/soshiki/gikai/teireikairinnjikai/teisyutugianntokekka/reiwa8nen2026nen/12064.html",
  },
};
