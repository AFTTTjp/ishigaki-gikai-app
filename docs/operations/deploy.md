# デプロイ・本番確認 運用メモ

## Production web URL

- **Production web URL**: https://ishigaki-gikai-app-web-coral.vercel.app
- **用途**: 本番UI確認・PR merge 後の目視確認
- **注意**: 公式公開ドメインが別にある場合は、これは **Vercel 本番URL** として扱う（公式ドメインとは別物）。

## 補足

- このURLは [`docs/20260410_石垣市議会版_議案追加運用メモ.md`](../20260410_石垣市議会版_議案追加運用メモ.md) にも記載がある。値を変更する場合は両方を更新すること。
- 公開サイトは `web` のみ。`admin` は別 Vercel プロジェクト。
- main へ merge すると Vercel が自動で本番デプロイする。merge 後はこのURLで目視確認する。
