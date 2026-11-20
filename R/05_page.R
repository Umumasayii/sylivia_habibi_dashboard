# -----------------------------------------------------------------------------
# 05_page.R — assemble the dashboard page (tabs, cards, filters)
# -----------------------------------------------------------------------------

fmt <- function(x, d = 2) ifelse(is.na(x) | is.nan(x), "–", formatC(x, format = "f", digits = d))

card <- function(title, ..., sub = NULL, wide = FALSE)
  div(class = paste("card", if (wide) "wide"),
      h3(title), if (!is.null(sub)) p(class = "sub", sub), ...)

kpi <- function(value, label, note = NULL)
  div(class = "kpi", div(class = "kpi-value", value), div(class = "kpi-label", label),
      if (!is.null(note)) div(class = "kpi-note", note))

tab_panel <- function(id, ...) div(class = "tab-panel", id = paste0("panel-", id), `data-tab` = id, ...)

alpha_note <- function(a) {
  if (is.na(a)) return("needs 3+ complete responses")
  if (a >= 0.8) "good" else if (a >= 0.7) "acceptable" else if (a >= 0.6) "questionable" else "low"
}

build_page <- function(a, data_file) {
  v <- a$valid
  has <- a$n_valid > 0

  # --------------------------- Overview
  overview <- tab_panel("overview",
    div(class = "kpis",
      kpi(a$n_all, "Submissions received"),
      kpi(a$n_valid, "Analysed respondents", "aged 18–50, in Rwanda, consented"),
      kpi(if (a$n_all) paste0(round(100 * a$n_valid / a$n_all), "%") else "–", "Eligible and consenting"),
      kpi(fmt(a$overall$mean), "Mean overall score", "1 = least, 4 = clearest self-understanding"),
      kpi(fmt(a$median_duration, 1), "Median minutes to complete"),
      kpi(fmt(a$overall$alpha), "Cronbach's α (21 items)", alpha_note(a$overall$alpha))
    ),
    div(class = "grid",
      card("Who reached the analysis", safe(plot_funnel(a)), sub = "Each step removes people who were not eligible or did not consent."),
      card("Submissions over time", safe(plot_by_date(a))),
      card("Theme scores at a glance", if (has) safe(plot_theme_means(a)) else no_data(),
           sub = "Higher = clearer self-understanding. Bars show the mean; whiskers the 95% confidence interval."),
      card("Time taken to complete", safe(plot_hist(pmin(v$duration_min, 60), "Minutes (values above 60 shown as 60)")))
    )
  )

  # --------------------------- Participants
  other_tbl <- if (nrow(a$other_activity)) dt_table(a$other_activity, page = 5) else no_data("No ‘Other’ activities specified yet.")
  participants <- tab_panel("participants",
    div(class = "grid",
      card("Age group", safe(plot_age(a)), sub = "Analysed respondents only."),
      card("Primary activity (Q4)", safe(plot_bar_h(a$activity, "option")), sub = "Select all that apply, so percentages can add up to more than 100%."),
      card("Current circumstances (Q5)", safe(plot_bar_h(a$circumstances, "option")), sub = "Select all that apply."),
      card("‘Other’ activities, as written", other_tbl)
    )
  )

  # --------------------------- Statements
  item_tbl <- a$items |>
    transmute(Item = paste0("Q", num), Statement = short, Theme = theme_label,
              `Reverse-scored` = ifelse(reverse, "Yes", "No"), Answered = n_answered,
              `% agree` = round(pct_agree), `% not sure` = round(pct_not_sure),
              `Mean (as answered)` = round(mean_raw, 2), `Mean score` = round(mean_scored, 2),
              SD = round(sd, 2))
  statements <- tab_panel("statements",
    div(class = "grid",
      card("How people answered each statement", safe(plot_likert(a)), wide = TRUE,
           sub = "Disagreement to the left of the line, agreement to the right. ‘Not sure’ is shown separately below."),
      card("Mean score per statement", safe(plot_item_means(a)), wide = TRUE,
           sub = "After reverse-scoring, so higher always means clearer self-understanding. Colour = theme; whiskers = 95% CI."),
      card("‘Not sure’ answers", safe(plot_not_sure(a)), wide = TRUE,
           sub = "A high share may point to a statement that is unclear or hard to judge."),
      card("Statement summary table", dt_table(item_tbl, page = 21), wide = TRUE)
    )
  )

  # --------------------------- Theme scores
  themes <- tab_panel("themes",
    div(class = "grid",
      card("Mean score by theme", if (has) safe(plot_theme_means(a)) else no_data()),
      card("Spread of theme scores", safe(plot_theme_box(a)), sub = "Each dot is one respondent."),
      card("Theme scores by age group", safe(plot_by_age(a)), wide = TRUE),
      card("Overall score by primary activity", safe(plot_score_by_group(a$score_by_activity)),
           sub = "People can appear in more than one group."),
      card("Overall score by circumstances", safe(plot_score_by_group(a$score_by_circumstances)),
           sub = "People can appear in more than one group."),
      card("How the themes relate (Pearson r)", safe(plot_cor(a)), wide = TRUE)
    )
  )

  # --------------------------- Reliability
  rel_tbl <- a$themes |>
    transmute(Theme = label, Items = items, `Complete responses` = n_complete,
              `Cronbach's α` = round(alpha, 2), `Mean inter-item r` = round(mean_r, 2),
              Interpretation = vapply(alpha, alpha_note, character(1)))
  it_tbl <- a$item_total |>
    transmute(Item = paste0("Q", num), Statement = short, Theme = theme_label,
              `Reverse-scored` = ifelse(reverse, "Yes", "No"),
              `Corrected item–total r` = round(corrected_r, 2),
              Flag = ifelse(!is.na(corrected_r) & corrected_r < 0, "Negative: check keying",
                     ifelse(!is.na(corrected_r) & corrected_r < 0.2, "Weak", "")))
  reliability <- tab_panel("reliability",
    div(class = "grid",
      card("Internal consistency by theme", dt_table(rel_tbl, page = 10), wide = TRUE,
           sub = "α of 0.70 or more is usually acceptable. Short themes (3 items) tend to have lower α."),
      card("Item–total correlations", dt_table(it_tbl, page = 21), wide = TRUE,
           sub = "Correlation of each item with the rest of its theme. A negative value usually means the item's reverse-scoring is wrong.")
    )
  )

  # --------------------------- Explore (linked filters)
  explore <- if (has) {
    resp <- v |>
      transmute(id, `Age group` = as.character(age_group),
                Identity = score_identity, Social = score_social, Feedback = score_feedback,
                Values = score_values, Reflection = score_reflect, Overall = score_overall,
                `Not sure answers` = n_not_sure, Minutes = round(duration_min, 1),
                Activity = activity_list, Circumstances = circumstances_list) |>
      mutate(`Main activity` = ifelse(Activity == "", "(none)", sub(";.*", "", Activity)))
    sd <- SharedData$new(resp, key = ~id, group = "respondents")
    filters <- list(filter_checkbox("f_age", "Age group", sd, ~`Age group`, inline = TRUE))
    rng <- range(resp$Overall, na.rm = TRUE)
    if (all(is.finite(rng)) && diff(rng) > 0)
      filters <- c(filters, list(filter_slider("f_overall", "Overall score", sd, ~Overall, step = 0.05, width = "100%")))
    filters <- c(filters, list(filter_checkbox("f_act", "Main activity (first listed)", sd, ~`Main activity`)))
    tab_panel("explore",
      div(class = "card wide filters", h3("Filter respondents"),
          p(class = "sub", "Filters update every chart and the table on this tab. Click or drag on a chart to highlight points."),
          div(class = "filter-row", tagList(filters))),
      div(class = "grid",
        card("Overall score distribution",
             plot_ly(sd, x = ~Overall, type = "histogram", nbinsx = 16,
                     marker = list(color = BLUE, line = list(color = "#fcfcfb", width = 1))) |>
               style_plot(height = 320, xtitle = "Overall score (1–4)", ytitle = "Respondents", legend = FALSE)),
        card("Who I am vs. Myself among others",
             plot_ly(sd, x = ~Identity, y = ~Social, type = "scatter", mode = "markers",
                     marker = list(color = BLUE, size = 10, opacity = 0.75, line = list(color = "#fcfcfb", width = 1.5)),
                     text = ~`Age group`, hovertemplate = "Identity %{x:.2f} · Social %{y:.2f}<br>%{text}<extra></extra>") |>
               style_plot(height = 320, xtitle = "Who I am (1–4)", ytitle = "Myself among others (1–4)", legend = FALSE) |>
               highlight(on = "plotly_selected", off = "plotly_deselect", color = "#eb6834")),
        card("Respondent scores", DT::datatable(sd, rownames = FALSE, extensions = "Buttons",
              class = "compact stripe hover",
              options = list(dom = "Bfrtip", buttons = c("copy", "csv", "excel"), pageLength = 10, scrollX = TRUE)),
             wide = TRUE)
      )
    )
  } else tab_panel("explore", no_data())

  # --------------------------- Comments
  comments <- tab_panel("comments",
    card("Open comments (Q27)", if (nrow(a$comments)) dt_table(a$comments, page = 15) else no_data("No comments yet."),
         wide = TRUE, sub = "Shown as written. Check for identifying details before sharing this page.")
  )

  # --------------------------- Methods
  rev_items <- paste0("Q", ITEMS$num[ITEMS$reverse], collapse = ", ")
  methods <- tab_panel("methods",
    card("How the numbers are calculated", wide = TRUE,
      tags$ol(
        tags$li(HTML("<b>Eligibility.</b> Only submissions aged 18–24, 25–34, 35–44 or 45–50, living in Rwanda and agreeing to participate are analysed.")),
        tags$li(HTML("<b>Answer codes.</b> Strongly disagree = 1, Disagree = 2, Agree = 3, Strongly agree = 4. ‘Not sure’ is treated as missing.")),
        tags$li(HTML(paste0("<b>Reverse-scoring.</b> For ", rev_items, ", agreeing suggests less self-clarity, so score = 5 − code. After this, a higher score always means clearer self-understanding."))),
        tags$li(HTML("<b>Theme scores.</b> Mean of a respondent's available item scores in each theme (1–4): Who I am Q6–Q10, Myself among others Q11–Q15, Strengths, criticism and mistakes Q16–Q20, Values and actions Q21–Q23, Emotions and reflection Q24–Q26. Overall = mean of Q6–Q26.")),
        tags$li(HTML("<b>Uncertainty.</b> 95% confidence intervals use the t distribution and need at least 2 respondents. Cronbach's α and item–total correlations need at least 3 complete responses.")),
        tags$li(HTML("<b>Both form versions.</b> Answers from the first version (statements S1–S21) are merged with the current one (Q6–Q26): S<i>n</i> = Q<i>n</i>+5."))
      ),
      p(class = "sub", HTML(paste0("Data file: <code>", htmlEscape(basename(data_file)),
                                   "</code>. Download the processed data: <a href='data/respondent_scores.csv'>respondent scores (CSV)</a> · <a href='data/statement_summary.csv'>statement summary (CSV)</a> · <a href='data/theme_summary.csv'>theme summary (CSV)</a>.")))
    )
  )

  tabs <- c(overview = "Overview", participants = "Participants", statements = "Statements",
            themes = "Theme scores", reliability = "Reliability", explore = "Explore",
            comments = "Comments", methods = "Methods")
  nav <- tags$nav(class = "tabs", lapply(names(tabs), function(k)
    tags$button(class = "tab", `data-target` = k, tabs[[k]])))

  updated <- format(Sys.time(), "%d %b %Y, %H:%M UTC", tz = "UTC")
  tagList(
    tags$head(
      tags$meta(charset = "utf-8"),
      tags$meta(name = "viewport", content = "width=device-width, initial-scale=1"),
      tags$title("Knowing and Living the Self — Survey Dashboard"),
      tags$link(rel = "stylesheet", href = "assets/style.css")
    ),
    div(class = "page",
      tags$header(class = "top",
        div(h1("Knowing and Living the Self"),
            p(class = "lead", "An anonymous survey of adults aged 18–50 in Rwanda · live results dashboard")),
        div(class = "meta", paste0(a$n_valid, " analysed of ", a$n_all, " submissions"), tags$br(),
            paste("Updated", updated))),
      nav,
      tags$main(overview, participants, statements, themes, reliability, explore, comments, methods),
      tags$footer("Built automatically with R from the KoBoToolbox export. Replace the file in data/ and push to refresh.")
    ),
    tags$script(src = "assets/app.js")
  )
}
