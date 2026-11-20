# -----------------------------------------------------------------------------
# 05_powerbi.R — tidy tables for Power BI (a small star schema)
#
# Written to public/data/powerbi/ and published with the website, so Power BI
# can read them from a fixed URL with anonymous access (no password, no gateway).
#
#   respondents.csv          one row per analysed respondent (scores, flags)
#   answers.csv              respondent x statement (long): answer, code, score
#   theme_scores.csv         respondent x theme (long): score, level
#   respondent_activity.csv  respondent x primary activity (bridge)
#   respondent_circumstance.csv respondent x circumstance (bridge)
#   items.csv                statement dimension
#   themes.csv               theme dimension
#   submissions.csv          every submission incl. ineligible (funnel, quality)
#   comments.csv             open comments (Q27)
#   meta.csv                 one row: last update time and counts
# -----------------------------------------------------------------------------

export_powerbi <- function(d, out_dir = "public/data/powerbi") {
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  w <- function(x, f) readr::write_csv(x, file.path(out_dir, f), na = "")
  level <- function(x) dplyr::case_when(is.na(x) ~ NA_character_, x >= 3 ~ "High", x >= 2 ~ "Moderate", TRUE ~ "Low")
  act <- attr(d, "activity_matrix"); circ <- attr(d, "circumstance_matrix")
  v <- d[d$eligible, ]; act_v <- act[d$eligible, , drop = FALSE]; circ_v <- circ[d$eligible, , drop = FALSE]

  theme_order <- tibble::tibble(theme = names(THEMES), theme_label = unname(THEMES), theme_order = seq_along(THEMES))

  # --- dimensions
  w(theme_order |> dplyr::bind_rows(tibble::tibble(theme = "overall", theme_label = "Overall score", theme_order = 6L)), "themes.csv")
  w(ITEMS |> dplyr::transmute(item, item_num = num, item_label = paste0("Q", num), statement_short = short,
                              statement = STATEMENT_TEXT, theme, reverse_scored = ifelse(reverse, "Yes", "No")), "items.csv")

  # --- respondents (fact at respondent grain)
  first_act <- apply(act_v, 1, function(r) if (any(r)) colnames(act_v)[which(r)[1]] else "(none)")
  resp <- tibble::tibble(
    id = v$id, submitted_date = v$date, age_group = as.character(v$age_group),
    age_order = match(as.character(v$age_group), AGE_LEVELS),
    main_activity = if (nrow(v)) first_act else character(0),
    n_activities = rowSums(act_v), n_circumstances = rowSums(circ_v),
    score_identity = v$score_identity, score_social = v$score_social, score_feedback = v$score_feedback,
    score_values = v$score_values, score_reflect = v$score_reflect, score_overall = v$score_overall,
    overall_level = level(v$score_overall),
    n_not_sure = v$n_not_sure, n_answered = v$n_answered, duration_min = round(v$duration_min, 2),
    has_comment = ifelse(is.na(v$comments), "No", "Yes")
  )
  w(resp, "respondents.csv")

  # --- answers (long)
  code <- c("Strongly disagree" = 1, "Disagree" = 2, "Agree" = 3, "Strongly agree" = 4, "Not sure" = 9)
  ans <- if (nrow(v)) purrr::map_dfr(ITEMS$item, function(q) tibble::tibble(
    id = v$id, item = q, answer = v[[q]], answer_code = unname(code[v[[q]]]), score = v[[paste0("r_", q)]])) else
    tibble::tibble(id = character(), item = character(), answer = character(), answer_code = numeric(), score = numeric())
  ans <- ans |> dplyr::filter(!is.na(answer)) |>
    dplyr::mutate(answer_order = dplyr::case_when(answer_code == 9 ~ 5, TRUE ~ answer_code),
                  agree = ifelse(answer_code %in% c(3, 4), 1L, ifelse(answer_code %in% c(1, 2), 0L, NA_integer_)),
                  not_sure = as.integer(answer_code == 9))
  w(ans, "answers.csv")

  # --- theme scores (long)
  ts <- if (nrow(v)) purrr::map_dfr(c(names(THEMES), "overall"), function(t) tibble::tibble(
    id = v$id, theme = t, score = v[[paste0("score_", t)]])) else tibble::tibble(id = character(), theme = character(), score = numeric())
  w(ts |> dplyr::filter(!is.na(score)) |> dplyr::mutate(level = level(score)), "theme_scores.csv")

  # --- bridges
  bridge <- function(mat, col) {
    if (!nrow(mat)) return(setNames(tibble::tibble(id = character(), x = character()), c("id", col)))
    idx <- which(mat, arr.ind = TRUE)
    setNames(tibble::tibble(id = v$id[idx[, 1]], x = colnames(mat)[idx[, 2]]), c("id", col)) |> dplyr::arrange(id)
  }
  w(bridge(act_v, "activity"), "respondent_activity.csv")
  w(bridge(circ_v, "circumstance"), "respondent_circumstance.csv")

  # --- all submissions (funnel + quality)
  w(tibble::tibble(
    id = d$id, submitted_date = d$date, age_group = as.character(d$age_group),
    age_eligible = ifelse(d$age_ok, "Yes", "No"), lives_rwanda = d$lives_rwanda, consent = d$consent,
    analysed = ifelse(d$eligible, "Yes", "No"), not_analysed_reason = ifelse(d$eligible, "", d$inelig_reason),
    duration_min = round(d$duration_min, 2),
    flag_speeder = ifelse(d$flag_speeder, "Yes", "No"), flag_straightline = ifelse(d$flag_straightline, "Yes", "No"),
    flag_many_not_sure = ifelse(d$flag_not_sure, "Yes", "No"), flag_incomplete = ifelse(d$flag_incomplete, "Yes", "No"),
    flag_duplicate = ifelse(d$flag_duplicate, "Yes", "No")
  ), "submissions.csv")

  w(tibble::tibble(id = v$id, submitted_date = v$date, age_group = as.character(v$age_group), comment = v$comments) |>
      dplyr::filter(!is.na(comment)), "comments.csv")

  w(tibble::tibble(last_updated_utc = format(Sys.time(), "%Y-%m-%d %H:%M:%S", tz = "UTC"),
                   source = "KoBoToolbox (processed in R)", submissions = nrow(d), analysed = nrow(v)), "meta.csv")
  invisible(TRUE)
}
