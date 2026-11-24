# -----------------------------------------------------------------------------
# 04_export.R — write the data the web dashboard reads (public/data/)
# -----------------------------------------------------------------------------

code_answer <- function(x) unname(c("Strongly disagree" = 1, "Disagree" = 2, "Agree" = 3,
                                    "Strongly agree" = 4, "Not sure" = 9)[x])

export_dashboard <- function(d, st, data_file, out_dir = "public/data") {
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)
  act <- attr(d, "activity_matrix"); circ <- attr(d, "circumstance_matrix")
  ans <- if (nrow(d)) sapply(ITEMS$item, function(q) code_answer(d[[q]])) else matrix(numeric(0), 0, nrow(ITEMS))
  if (is.null(dim(ans))) ans <- matrix(ans, nrow = nrow(d))
  colnames(ans) <- ITEMS$item

  records <- lapply(seq_len(nrow(d)), function(i) list(
    id = d$id[i],
    date = if (is.na(d$date[i])) NULL else format(d$date[i]),
    age = if (is.na(d$age_group[i])) NULL else as.character(d$age_group[i]),
    lives = d$lives_rwanda[i] %||% NULL, consent = d$consent[i] %||% NULL,
    eligible = isTRUE(d$eligible[i]), reason = d$inelig_reason[i],
    act = as.list(colnames(act)[act[i, ]]), circ = as.list(colnames(circ)[circ[i, ]]),
    act_other = if (is.na(d$activity_other[i])) NULL else d$activity_other[i],
    a = as.list(setNames(ifelse(is.na(ans[i, ]), NA, ans[i, ]), ITEMS$item)),
    mins = if (is.na(d$duration_min[i])) NULL else round(d$duration_min[i], 2),
    comment = if (is.na(d$comments[i])) NULL else d$comments[i],
    flags = as.list(c(speeder = d$flag_speeder[i], straightline = d$flag_straightline[i],
                      not_sure = d$flag_not_sure[i], incomplete = d$flag_incomplete[i],
                      duplicate = d$flag_duplicate[i]))
  ))

  payload <- list(
    meta = list(title = "Knowing and Living the Self",
                subtitle = "An anonymous survey of adults aged 18–50 in Rwanda",
                data_file = source_label(data_file),
                source = if (tolower(tools::file_ext(data_file)) == "json") "kobo"
                         else if (nzchar(Sys.getenv("DATA_SOURCE"))) Sys.getenv("DATA_SOURCE") else "file",
                built = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
                n_all = nrow(d), n_valid = sum(d$eligible)),
    themes = lapply(names(THEMES), function(t) list(key = t, label = THEMES[[t]],
                                                    items = ITEMS$item[ITEMS$theme == t])),
    items = lapply(seq_len(nrow(ITEMS)), function(i) list(
      key = ITEMS$item[i], num = ITEMS$num[i], short = ITEMS$short[i],
      theme = ITEMS$theme[i], reverse = ITEMS$reverse[i])),
    statements = setNames(as.list(STATEMENT_TEXT), ITEMS$item),
    activity_options = colnames(act), circumstance_options = colnames(circ),
    records = records,
    stats = list(
      n = st$n,
      reliability = st$reliability,
      item_cor = if (is.null(st$item_cor)) NULL else unname(round(st$item_cor, 3)),
      tests = st$tests
    )
  )
  json <- jsonlite::toJSON(payload, auto_unbox = TRUE, na = "null", null = "null", digits = 6)
  writeLines(json, file.path(out_dir, "dashboard.json"), useBytes = TRUE)
  writeLines(paste0("window.DASHBOARD_DATA = ", json, ";"), file.path(out_dir, "dashboard.js"), useBytes = TRUE)

  # Tidy CSV for analysts (eligible respondents)
  v <- d[d$eligible, ]
  out <- v |>
    dplyr::transmute(id, date, age_group, lives_rwanda, consent,
                     activity = activity_list, circumstances = circumstances_list, activity_other) |>
    dplyr::bind_cols(v[ITEMS$item], v[paste0("r_", ITEMS$item)],
                     v[c(paste0("score_", names(THEMES)), "score_overall", "n_not_sure",
                         "n_answered", "duration_min", "comments")])
  # Self-Clarity Index (0–100) per theme and overall: (mean score − 1) / 3 × 100
  to_idx <- function(x) round((x - 1) / 3 * 100, 1)
  for (t in c(names(THEMES), "overall")) out[[paste0("index_", t)]] <- to_idx(v[[paste0("score_", t)]])
  out$level_overall <- cut(out$index_overall, c(-Inf, 40, 70, Inf), right = FALSE,
                           labels = c("Low", "Moderate", "High"))
  readr::write_csv(out, file.path(out_dir, "respondent_scores.csv"), na = "")
  invisible(TRUE)
}

source_label <- function(data_file) {
  if (tolower(tools::file_ext(data_file)) == "json") return("KoBoToolbox API (live)")
  if (identical(Sys.getenv("DATA_SOURCE"), "forms")) return("Microsoft Forms · Excel on SharePoint (live)")
  basename(data_file)
}
