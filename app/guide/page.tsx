import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Search, Globe, CalendarDays, Clock, Users, Eye, Flame, Zap,
  CheckSquare, Download, Link2, Lightbulb, Target, TrendingUp, Compass, BarChart3, ShieldAlert,
} from "lucide-react";

export const metadata: Metadata = {
  title: "できること・活用方法 | YouTube 高精度検索ツール | EAVAL",
  description: "YouTube 高精度検索ツールでできること、わかること、リサーチへの活かし方",
};

const RED = "#e63946";
const INK = "#111827";
const MUTE = "#6b7280";
const FAINT = "rgba(0,0,0,0.38)";

function Section({ icon, title, lead, children }: { icon: React.ReactNode; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="lg-panel p-7 space-y-5">
      <div className="flex items-center gap-3">
        <div className="lg-step-icon flex h-10 w-10 items-center justify-center" style={{ color: RED }}>{icon}</div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: INK }}>{title}</h2>
          {lead && <p className="text-xs" style={{ color: FAINT }}>{lead}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="lg-step-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span style={{ color: RED }}>{icon}</span>
        <p className="text-sm font-bold" style={{ color: INK }}>{title}</p>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: MUTE }}>{children}</p>
    </div>
  );
}

function Formula({ name, formula, meaning, line }: { name: string; formula: string; meaning: string; line: string }) {
  return (
    <div className="lg-step-card p-5 space-y-2">
      <p className="text-sm font-bold" style={{ color: INK }}>{name}</p>
      <p className="font-mono text-base font-semibold" style={{ color: RED }}>{formula}</p>
      <p className="text-xs leading-relaxed" style={{ color: MUTE }}>{meaning}</p>
      <p className="text-xs font-semibold" style={{ color: "#78350f" }}>{line}</p>
    </div>
  );
}

const filters = [
  { icon: <Search className="h-4 w-4" />, title: "キーワード（部分一致／完全一致）", body: "部分一致は YouTube の関連度順。完全一致はタイトルにキーワードを含む動画だけに絞る。" },
  { icon: <Globe className="h-4 w-4" />, title: "公開地域（日本／韓国／アメリカ）", body: "地域を切り替えるとキーワードを韓国語・英語に自動翻訳。海外の先行トレンドをそのまま検索できる。" },
  { icon: <CalendarDays className="h-4 w-4" />, title: "公開日（7日〜3年・カスタム）", body: "「直近28日で伸びている企画」のように、鮮度を揃えて比較できる。" },
  { icon: <Clock className="h-4 w-4" />, title: "動画時間（複数選択）", body: "3分未満＝ショート寄り、3〜20分＝通常、20分以上＝長尺。自分が出す尺と同じ土俵で見る。" },
  { icon: <Users className="h-4 w-4" />, title: "チャンネル登録者数（8段階・複数選択）", body: "自分と同規模のチャンネルだけに絞れる。大手の数字に惑わされずに現実的な目標が立つ。" },
  { icon: <Eye className="h-4 w-4" />, title: "再生回数の下限", body: "1,000回〜10万回以上、またはカスタム。ノイズになる小さい動画を除く。" },
  { icon: <Flame className="h-4 w-4" />, title: "拡散率の下限", body: "再生回数÷登録者数。社内の採用ラインは 5倍以上。" },
  { icon: <Zap className="h-4 w-4" />, title: "異常値の下限", body: "再生回数÷そのチャンネルの最新50本の中央値。普段の実力に対してどれだけ跳ねたか。" },
];

const uses = [
  { icon: <Target className="h-5 w-5" />, title: "参入前に市場規模を測る", steps: ["ジャンルのキーワードで検索し、公開日を「直近1年」、動画時間を自分が出す尺に合わせる", "再生回数順に並べ、自分のテーマに合う動画を10本チェック（MVや超大手は外す）", "「アクティブユーザーを算出」で平均と中央値を見る。平均が目標再生回数の目安"] },
  { icon: <TrendingUp className="h-5 w-5" />, title: "伸びる企画の型を見つける", steps: ["拡散率を「5倍以上」にして検索。登録者以外に届いた動画だけが残る", "残った動画のタイトル・サムネに共通する切り口を書き出す", "異常値も高ければ、そのチャンネルにとっても特別に当たった企画＝再現性が高い"] },
  { icon: <Compass className="h-5 w-5" />, title: "同規模チャンネルをベンチマークにする", steps: ["登録者数を自分の1〜2段階上のレンジだけ選ぶ", "異常値 2倍以上で、そのチャンネルの中で跳ねた動画を抽出", "チャンネル名をクリックして、跳ねた動画の前後で何を変えたかを見る"] },
  { icon: <BarChart3 className="h-5 w-5" />, title: "海外トレンドを先取りする", steps: ["公開地域をアメリカか韓国にする（キーワードは自動翻訳）", "公開日「直近90日」で、日本にまだ無い切り口を探す", "CSVに落として、日本版の企画候補リストにする"] },
];

export default function GuidePage() {
  return (
    <div className="lg-base">
      <header className="lg-header sticky top-0 z-20 px-6 py-3.5 flex items-center gap-3">
        <Image src="/eaval-logo.png" alt="EAVAL" width={30} height={30} className="flex-shrink-0 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold" style={{ color: INK }}>できること・活用方法</span>
          <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>YouTube 高精度検索ツール by 株式会社EAVAL</span>
        </div>
        <Link href="/" className="lg-csv-btn ml-auto flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold" style={{ color: "#374151" }}>
          <ArrowLeft className="h-3.5 w-3.5" />
          ツールに戻る
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        <div className="lg-panel p-8 text-center space-y-3">
          <h1 className="text-2xl font-bold leading-relaxed" style={{ color: INK }}>
            YouTube の検索に<span style={{ color: RED }}>数字の目</span>を足すツールです
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: MUTE }}>
            通常のYouTube検索は「関連度」でしか並びません。このツールは YouTube Data API で最大200本を取得し、
            再生回数・登録者数・チャンネルごとの平均的な実力まで一緒に取ってきます。
            だから「どれが本当に伸びた動画か」「自分の規模で何回が現実的か」が、検索結果を眺めるだけでわかります。
          </p>
        </div>

        <Section icon={<Search className="h-5 w-5" />} title="できること" lead="8つの条件を組み合わせて絞り込む">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filters.map((f) => (
              <Card key={f.title} icon={f.icon} title={f.title}>{f.body}</Card>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <Card icon={<CheckSquare className="h-4 w-4" />} title="チェックして平均・中央値を算出">動画を選んで「アクティブユーザーを算出」。選んだ動画の平均再生回数と中央値が出る。</Card>
            <Card icon={<Download className="h-4 w-4" />} title="CSVダウンロード">絞り込んだ結果を登録者数・拡散率・異常値つきで書き出し。スプレッドシートで続きの分析ができる。</Card>
            <Card icon={<Link2 className="h-4 w-4" />} title="タイトルクリックで動画へ・URLコピー">タイトルは新しいタブで動画を開く。右端のボタンでURLをコピーして企画書やチャットに貼れる。</Card>
          </div>
        </Section>

        <Section icon={<Lightbulb className="h-5 w-5" />} title="わかること" lead="2つの指標で「伸びた理由」を切り分ける">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Formula
              name="拡散率"
              formula="再生回数 ÷ チャンネル登録者数"
              meaning="登録者以外、つまり新規の視聴者にどれだけ届いたか。登録者1万人で5万回なら 5倍。企画そのものの強さを表す。"
              line="社内の採用ライン：5倍以上"
            />
            <Formula
              name="異常値"
              formula="再生回数 ÷ そのチャンネルの最新50本の中央値"
              meaning="そのチャンネルの普段の実力に対して何倍跳ねたか。中央値を使うので、一発当たった動画に基準が引きずられない。"
              line="目安：2倍以上で「普段と違う何かがあった動画」"
            />
          </div>
          <div className="lg-amber px-4 py-3 text-xs leading-relaxed" style={{ color: "#78350f" }}>
            <strong>2つを組み合わせて読む：</strong>
            拡散率が高く異常値も高い＝企画の力で跳ねた（真似する価値あり）。
            拡散率が高いのに異常値が低い＝そのチャンネルはいつも登録者以上に届いている（チャンネル自体の力）。
            拡散率が低く異常値だけ高い＝大手がたまたま当てた動画（規模が違うので参考にしにくい）。
          </div>
        </Section>

        <Section icon={<Compass className="h-5 w-5" />} title="活用方法" lead="目的別の手順">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uses.map((u) => (
              <div key={u.title} className="lg-step-card p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="lg-step-icon flex h-9 w-9 items-center justify-center" style={{ color: RED }}>{u.icon}</div>
                  <p className="text-sm font-bold" style={{ color: INK }}>{u.title}</p>
                </div>
                <ol className="space-y-1.5">
                  {u.steps.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-xs leading-relaxed" style={{ color: MUTE }}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "linear-gradient(145deg,#f04050,#c01020)" }}>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<ShieldAlert className="h-5 w-5" />} title="使うときの注意">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card icon={<Search className="h-4 w-4" />} title="取得は関連度順の上位200本まで">YouTube が関連度で返した順に最大200本を取り、その中で絞り込む。「全動画の中で」ではなく「検索上位200本の中で」の結果。</Card>
            <Card icon={<Users className="h-4 w-4" />} title="登録者数非公開のチャンネルは拡散率が0になる">登録者数を隠しているチャンネルは分母が取れないため、拡散率 0 と表示される。異常値のほうを見る。</Card>
            <Card icon={<Zap className="h-4 w-4" />} title="APIの利用枠は1日10,000ユニット">1回の検索で検索4回（400）＋チャンネルごとに2〜3ユニット。1日に数十回の検索が目安。枠を超えたら翌日（太平洋時間0時）に戻る。</Card>
            <Card icon={<Globe className="h-4 w-4" />} title="シークレットブラウザの検索とは並びが違う">個人の視聴履歴は入らないが、API は関連度固定で件数も多い。ブラウザで上に出る動画と一致しないことがある。</Card>
          </div>
        </Section>

        <div className="text-center pt-2">
          <Link href="/" className="lg-search-btn inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-white">
            <Search className="h-4 w-4" />
            ツールを使う
          </Link>
        </div>
      </main>
    </div>
  );
}
