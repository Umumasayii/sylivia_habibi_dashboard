# Knowing and Living the Self — Survey Dashboard

An interactive dashboard for the anonymous Microsoft Forms survey of adults aged 18–50 in Rwanda.
Everything is computed in **R**; the result is a static website in `public/`, which Vercel hosts.

## Automatic updates from Microsoft Forms (Excel on SharePoint)

Microsoft Forms writes every response to a responses workbook in SharePoint/OneDrive.
The dashboard reads that workbook — no manual uploads needed.

1. Every 5 minutes, GitHub Actions downloads the workbook through a view-only share link
   (`scripts/fetch_excel.sh`).
2. If the responses changed (new, edited or deleted), R rebuilds the dashboard and commits `public/`.
3. Vercel publishes the new version; open dashboards notice it within 2 minutes and refresh themselves.

Raw responses are never committed to the repository; only the processed dashboard data is.

### One-time setup

1. In Microsoft Forms open the form → **Responses → Open results in Excel**. This opens the
   responses workbook that stays in sync with the form (keep it where it is; don't rename its sheet).
2. In that workbook click **Share → Copy link**, set the link to **Anyone with the link · Can view**,
   and copy it.
3. On GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   name `EXCEL_URL`, value = the link from step 2.
4. **Actions → Build dashboard → Run workflow** once to test.

The R reader matches the workbook's columns by question wording, so keep the question titles in
the form as they are (adding words at the end is fine; rewording the start of a title is not).

### Optional: update within a minute of each response

A Power Automate flow (*When a new response is submitted* → *HTTP* POST to
`https://api.github.com/repos/Umumasayii/sylivia_habibi_dashboard/dispatches` with body
`{"event_type": "new_response"}` and headers `Authorization: Bearer <fine-grained token with Contents: Read and write>`,
`Accept: application/vnd.github+json`) triggers a rebuild straight away. The HTTP action needs a
Power Automate premium licence; without it the 5-minute schedule does the job.

### Without the link (fallback)

If `EXCEL_URL` is not set, the build uses the newest `.xlsx`/`.xls`/`.csv` file in `data/` instead
(a Microsoft Forms download or an older KoBoToolbox export both work).

> The repository should be **public** for a 5-minute schedule: public repositories get unlimited free Actions minutes, while private ones get 2,000 a month (enough for about a 30-minute schedule). To change the frequency, edit the `cron` line in `.github/workflows/build-dashboard.yml`.

> GitHub pauses scheduled workflows in repositories with no activity for 60 days. If that happens, open **Actions** and re-enable the workflow.

## What the dashboard shows

A single-page web app (sidebar navigation, global filters, light/dark theme, value labels, shareable links, PDF printing):

| Page | Contents |
| --- | --- |
| Overview | Narrative summary, KPI cards, theme scores with 95% CIs, score levels, key findings, eligibility funnel |
| Respondents | Age, primary activity (Q4), circumstances (Q5), circumstances × age heatmap — click any bar to filter everything |
| Statements | Diverging agree/disagree chart, reverse-scored item means with CIs, shaded summary table, single-statement drill-down by age |
| Themes | Theme means, violin plots, live group comparisons, score levels, correlations, scatter, and R significance tests (Kruskal–Wallis / Wilcoxon, effect sizes, Benjamini–Hochberg) |
| Data explorer | Bordered, searchable table of every response with per-column filters, column picker and Copy/CSV/Excel/Print export; open comments |
| Methods & quality | Cronbach's α with bootstrap CIs, item diagnostics, completion time, ineligibility reasons, flagged responses, scoring rules, codebook |

## Scoring rules

- Analysed respondents: aged 18–50, living in Rwanda, and consenting.
- Strongly disagree = 1, Disagree = 2, Agree = 3, Strongly agree = 4; ‘Not sure’ = missing.
- Reverse-scored (5 − code): Q6–Q9, Q11–Q14, Q17, Q18. Higher scores always mean clearer self-understanding.
- Themes: Who I am (Q6–Q10), Myself among others (Q11–Q15), Strengths, criticism and mistakes (Q16–Q20), Values and actions (Q21–Q23), Emotions and reflection (Q24–Q26). Overall = Q6–Q26.

The rules live in `R/01_setup.R` (`ITEMS`, `THEMES`) — edit them there and push to change the whole dashboard.

## Project layout

```
data/                      optional fallback data file (Forms or KoBo export)
R/01_setup.R               item list, themes, reverse-scored items, options
R/02_clean.R               reads the Forms workbook or a KoBo export, standardises it, scores it, flags quality issues
R/03_stats.R               reliability (bootstrap CIs), item diagnostics, group tests
R/04_export.R              writes public/data/dashboard.js|json and respondent_scores.csv
build_dashboard.R          entry point: Rscript build_dashboard.R
site/                      the web app (HTML, CSS, JS, bundled libraries) — copied to public/
public/                    generated website (do not edit by hand)
.github/workflows/         automatic rebuild on push
vercel.json                Vercel serves public/ as a static site
```

## Run it on your computer

```r
install.packages(c("readxl", "readr", "dplyr", "tidyr", "stringr", "purrr", "tibble", "jsonlite"))
```

Then, from the project folder: `Rscript build_dashboard.R` and open `public/index.html` in a browser.

## Connect Vercel (one time)

1. On vercel.com: **Add New → Project → Import** this GitHub repository.
2. Framework preset: **Other**. Leave the build settings as they are — `vercel.json` sets them (output directory `public`).
3. Deploy. Each time the GitHub Action commits a new `public/`, Vercel redeploys automatically.

> Privacy: a Vercel URL is public unless you turn on Vercel's deployment protection. The Comments tab shows open answers as written.
