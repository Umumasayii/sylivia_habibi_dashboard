# -----------------------------------------------------------------------------
# 03_analysis.R — summary tables used by the dashboard
# -----------------------------------------------------------------------------

ci95 <- function(x) {
  x <- x[!is.na(x)]; n <- length(x)
  if (n < 2) return(c(mean = if (n) mean(x) else NA, lo = NA, hi = NA, sd = NA, n = n))
  m <- mean(x); s <- sd(x); h <- qt(0.975, n - 1) * s / sqrt(n)
  c(mean = m, lo = m - h, hi = m + h, sd = s, n = n)
}

cronbach <- function(m) {
  m <- as.matrix(m); m <- m[stats::complete.cases(m), , drop = FALSE]
  k <- ncol(m)
  if (nrow(m) < 3 || k < 2) return(list(alpha = NA, n = nrow(m), item_r = rep(NA, k), mean_r = NA))
  v <- apply(m, 2, var); tot <- rowSums(m)
  alpha <- if (var(tot) > 0) (k / (k - 1)) * (1 - sum(v) / var(tot)) else NA
  item_r <- vapply(seq_len(k), function(j) {
    rest <- rowSums(m[, -j, drop = FALSE])
    if (sd(m[, j]) > 0 && sd(rest) > 0) cor(m[, j], rest) else NA_real_
  }, numeric(1))
  cm <- suppressWarnings(cor(m)); mean_r <- mean(cm[upper.tri(cm)], na.rm = TRUE)
  list(alpha = alpha, n = nrow(m), item_r = item_r, mean_r = ifelse(is.nan(mean_r), NA, mean_r))
}

pct <- function(x, n) ifelse(n > 0, 100 * x / n, NA)

analyse <- function(d) {
  v <- d |> filter(eligible)
  out <- list(all = d, valid = v, n_all = nrow(d), n_valid = nrow(v))

  # Response funnel
  out$funnel <- tibble::tibble(
    stage = c("All submissions", "Aged 18–50", "Lives in Rwanda", "Gave consent (analysed)"),
    n = c(nrow(d), sum(d$age_ok), sum(d$age_ok & d$lives_rwanda %in% "Yes"), nrow(v))
  )
  out$by_date <- d |> filter(!is.na(date)) |> count(date)

  # Background
  out$age <- v |> count(age_group, .drop = FALSE) |> filter(age_group %in% AGE_VALID) |>
    mutate(pct = pct(n, nrow(v)))
  multi_tab <- function(mat) {
    mat <- mat[d$eligible, , drop = FALSE]
    tibble::tibble(option = colnames(mat), n = colSums(mat)) |>
      mutate(pct = pct(n, nrow(v))) |> arrange(desc(n))
  }
  out$activity      <- multi_tab(attr(d, "activity_matrix"))
  out$circumstances <- multi_tab(attr(d, "circumstance_matrix"))
  out$other_activity <- v |> filter(!is.na(activity_other)) |> select(`Other activity` = activity_other)

  # Item-level
  long <- v |> select(id, all_of(ITEMS$item)) |>
    pivot_longer(-id, names_to = "item", values_to = "answer") |> filter(!is.na(answer))
  out$likert <- long |> count(item, answer) |>
    complete(item = ITEMS$item, answer = LIKERT_LEVELS, fill = list(n = 0)) |>
    group_by(item) |> mutate(total = sum(n), pct = pct(n, total),
                             pct_sub = pct(n, sum(n[answer != "Not sure"]))) |> ungroup() |>
    left_join(ITEMS, by = "item")

  out$items <- purrr::map_dfr(seq_len(nrow(ITEMS)), function(i) {
    it <- ITEMS$item[i]; raw <- v[[it]]; r <- v[[paste0("r_", it)]]
    s <- ci95(r); answered <- sum(!is.na(raw)); subs <- sum(!is.na(r))
    tibble::tibble(item = it,
                   n_answered = answered,
                   pct_agree = pct(sum(raw %in% c("Agree", "Strongly agree")), subs),
                   pct_not_sure = pct(sum(raw %in% "Not sure"), answered),
                   mean_raw = mean(unname(LIKERT_SCORE[raw]), na.rm = TRUE),
                   mean_scored = s[["mean"]], lo = s[["lo"]], hi = s[["hi"]], sd = s[["sd"]])
  }) |> left_join(ITEMS, by = "item") |>
    mutate(across(c(mean_raw, mean_scored), ~ ifelse(is.nan(.x), NA, .x)))

  # Theme scores
  out$themes <- purrr::map_dfr(names(THEMES), function(t) {
    s <- ci95(v[[paste0("score_", t)]])
    rel <- cronbach(v[paste0("r_", ITEMS$item[ITEMS$theme == t])])
    tibble::tibble(theme = t, label = THEMES[[t]], items = sum(ITEMS$theme == t),
                   mean = s[["mean"]], lo = s[["lo"]], hi = s[["hi"]], sd = s[["sd"]], n = s[["n"]],
                   alpha = rel$alpha, mean_r = rel$mean_r, n_complete = rel$n)
  })
  ov <- ci95(v$score_overall); rel_all <- cronbach(v[paste0("r_", ITEMS$item)])
  out$overall <- list(mean = ov[["mean"]], lo = ov[["lo"]], hi = ov[["hi"]], sd = ov[["sd"]],
                      alpha = rel_all$alpha, n_complete = rel_all$n)

  out$item_total <- purrr::map_dfr(names(THEMES), function(t) {
    its <- ITEMS |> filter(theme == t)
    rel <- cronbach(v[paste0("r_", its$item)])
    its |> mutate(corrected_r = rel$item_r)
  })

  # Scores by groups
  score_cols <- c(paste0("score_", names(THEMES)), "score_overall")
  out$by_age <- v |> filter(!is.na(age_group)) |> group_by(age_group) |>
    summarise(n = n(), across(all_of(score_cols), ~ mean(.x, na.rm = TRUE)), .groups = "drop") |>
    mutate(across(all_of(score_cols), ~ ifelse(is.nan(.x), NA, .x)))
  by_multi <- function(mat) {
    mat <- mat[d$eligible, , drop = FALSE]
    purrr::map_dfr(colnames(mat), function(o) {
      x <- v$score_overall[mat[, o]]; s <- ci95(x)
      tibble::tibble(option = o, n = sum(mat[, o]), mean = s[["mean"]], lo = s[["lo"]], hi = s[["hi"]])
    }) |> filter(n > 0)
  }
  out$score_by_activity      <- by_multi(attr(d, "activity_matrix"))
  out$score_by_circumstances <- by_multi(attr(d, "circumstance_matrix"))

  sc <- v[paste0("score_", names(THEMES))]
  out$cor <- if (sum(stats::complete.cases(sc)) >= 3) suppressWarnings(cor(sc, use = "pairwise.complete.obs")) else NULL

  out$comments <- v |> filter(!is.na(comments)) |>
    transmute(Date = format(date), `Age group` = as.character(age_group), Comment = comments)
  out$median_duration <- suppressWarnings(median(v$duration_min, na.rm = TRUE))
  out
}
