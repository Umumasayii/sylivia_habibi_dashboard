# Knowing and Living the Self — Survey Dashboard

An interactive dashboard for the anonymous KoBoToolbox survey of adults aged 18–50 in Rwanda.
Everything is computed in **R**; the result is a static website in `public/`, which Vercel hosts.

## Update the dashboard with new data

1. In KoBoToolbox go to **Data → Downloads** and export as **XLS** (Labels, or XML values and headers — both work; all form versions are merged).
2. Replace the file in `data/` with the new export (keep **one** file in that folder; any name ending in `.xlsx`, `.xls` or `.csv` works).
3. Commit and push to `main`.

GitHub Actions then runs R, rebuilds `public/`, commits it, and Vercel redeploys — usually within 3–5 minutes.
You can also start a rebuild by hand: **Actions → Build dashboard → Run workflow**.

## What the dashboard shows

| Tab | Contents |
| --- | --- |
| Overview | Key figures, eligibility funnel, submissions over time, theme scores, completion time |
| Participants | Age group, primary activity (Q4), circumstances (Q5), ‘Other’ answers |
| Statements | Agree/disagree distribution for Q6–Q26, mean score per statement, ‘Not sure’ rates, summary table |
| Theme scores | Theme means with 95% CIs, score spread, scores by age, activity and circumstances, theme correlations |
| Reliability | Cronbach's α per theme and corrected item–total correlations |
| Explore | Linked filters (age, score range, main activity) driving a histogram, scatter plot and respondent table |
| Comments | Open answers to Q27 |
| Methods | Scoring rules and CSV downloads of the processed data |

## Scoring rules

- Analysed respondents: aged 18–50, living in Rwanda, and consenting.
- Strongly disagree = 1, Disagree = 2, Agree = 3, Strongly agree = 4; ‘Not sure’ = missing.
- Reverse-scored (5 − code): Q6–Q9, Q11–Q14, Q17, Q18. Higher scores always mean clearer self-understanding.
- Themes: Who I am (Q6–Q10), Myself among others (Q11–Q15), Strengths, criticism and mistakes (Q16–Q20), Values and actions (Q21–Q23), Emotions and reflection (Q24–Q26). Overall = Q6–Q26.

The rules live in `R/01_setup.R` (`ITEMS`, `THEMES`) — edit them there and push to change the whole dashboard.

## Project layout

```
data/                      KoBo export (replace this)
R/01_setup.R               packages, item list, themes, colours
R/02_clean.R               reads any KoBo export and standardises it
R/03_analysis.R            summaries, confidence intervals, Cronbach's alpha
R/04_plots.R               plotly charts and DT tables
R/05_page.R                page layout and tabs
build_dashboard.R          entry point: Rscript build_dashboard.R
assets/                    CSS and tab script
public/                    generated website (do not edit by hand)
.github/workflows/         automatic rebuild on push
vercel.json                Vercel serves public/ as a static site
```

## Run it on your computer

```r
install.packages(c("readxl", "readr", "dplyr", "tidyr", "stringr", "purrr", "tibble",
                   "plotly", "DT", "crosstalk", "htmltools", "htmlwidgets", "jsonlite"))
```

Then, from the project folder: `Rscript build_dashboard.R` and open `public/index.html`.

## Connect Vercel (one time)

1. On vercel.com: **Add New → Project → Import** this GitHub repository.
2. Framework preset: **Other**. Leave the build settings as they are — `vercel.json` sets them (output directory `public`).
3. Deploy. Each time the GitHub Action commits a new `public/`, Vercel redeploys automatically.

> Privacy: a Vercel URL is public unless you turn on Vercel's deployment protection. The Comments tab shows open answers as written.
