# -----------------------------------------------------------------------------
# 03_stats.R — inferential statistics computed in R (full analysed sample)
#   * Cronbach's alpha with bootstrap 95% CI, alpha-if-deleted, item-total r
#   * inter-item correlation matrix
#   * group comparisons (Kruskal–Wallis / Wilcoxon) with effect sizes and
#     Benjamini–Hochberg adjusted p-values
# -----------------------------------------------------------------------------

cronbach_alpha <- function(m) {
  m <- as.matrix(m); k <- ncol(m)
  if (nrow(m) < 3 || k < 2) return(NA_real_)
  vt <- var(rowSums(m)); if (!is.finite(vt) || vt <= 0) return(NA_real_)
  (k / (k - 1)) * (1 - sum(apply(m, 2, var)) / vt)
}

reliability <- function(v, items, B = 1000) {
  m <- as.matrix(v[paste0("r_", items)]); m <- m[stats::complete.cases(m), , drop = FALSE]
  n <- nrow(m); a <- cronbach_alpha(m)
  ci <- c(NA, NA)
  if (n >= 10 && is.finite(a)) {
    set.seed(2026)
    boots <- replicate(B, cronbach_alpha(m[sample.int(n, n, replace = TRUE), , drop = FALSE]))
    ci <- unname(stats::quantile(boots, c(0.025, 0.975), na.rm = TRUE))
  }
  cm <- if (n >= 3) suppressWarnings(cor(m)) else matrix(NA, ncol(m), ncol(m))
  mean_r <- if (n >= 3) mean(cm[upper.tri(cm)], na.rm = TRUE) else NA
  per_item <- lapply(seq_along(items), function(j) {
    rest <- if (ncol(m) > 1) rowSums(m[, -j, drop = FALSE]) else rep(NA, n)
    r <- if (n >= 3 && sd(m[, j]) > 0 && sd(rest) > 0) cor(m[, j], rest) else NA
    aid <- if (ncol(m) > 2) cronbach_alpha(m[, -j, drop = FALSE]) else NA
    list(item = items[j], item_total_r = r, alpha_if_deleted = aid)
  })
  list(alpha = a, lo = ci[1], hi = ci[2], n = n, k = length(items),
       mean_r = ifelse(is.nan(mean_r), NA, mean_r), items = per_item)
}

group_tests <- function(v) {
  outcomes <- c(setNames(paste0("score_", names(THEMES)), THEMES), "Overall score" = "score_overall")
  rows <- list()
  add <- function(...) rows[[length(rows) + 1]] <<- list(...)

  # Age group: Kruskal–Wallis, epsilon-squared
  ag <- droplevels(v$age_group)
  for (o in names(outcomes)) {
    y <- v[[outcomes[[o]]]]; ok <- !is.na(y) & !is.na(ag)
    tab <- table(ag[ok]); g <- names(tab)[tab >= 2]
    keep <- ok & ag %in% g
    if (length(g) >= 2 && sum(keep) >= 6) {
      kt <- kruskal.test(y[keep], droplevels(ag[keep])); N <- sum(keep)
      eps <- unname(kt$statistic) / (N - 1)
      add(family = "Age group", comparison = paste(g, collapse = " vs "), outcome = o,
          test = "Kruskal–Wallis", statistic = unname(kt$statistic), df = unname(kt$parameter),
          p = kt$p.value, effect = eps, effect_name = "ε²", n = N,
          detail = paste(sprintf("%s: %.2f", g, tapply(y[keep], droplevels(ag[keep]), mean)), collapse = "; "))
    }
  }
  # Membership groups: Wilcoxon rank-sum, r = |Z|/sqrt(N)
  for (fam in c("Primary activity", "Circumstances")) {
    mat <- attr(v, if (fam == "Primary activity") "activity_matrix" else "circumstance_matrix")
    for (opt in colnames(mat)) {
      inn <- mat[, opt]
      for (o in names(outcomes)) {
        y <- v[[outcomes[[o]]]]; ok <- !is.na(y)
        a <- y[ok & inn]; b <- y[ok & !inn]
        if (length(a) >= 3 && length(b) >= 3) {
          wt <- suppressWarnings(wilcox.test(a, b, exact = FALSE))
          z <- qnorm(wt$p.value / 2); N <- length(a) + length(b)
          add(family = fam, comparison = paste0(opt, " vs others"), outcome = o,
              test = "Wilcoxon rank-sum", statistic = unname(wt$statistic), df = NA,
              p = wt$p.value, effect = abs(z) / sqrt(N), effect_name = "r", n = N,
              detail = sprintf("%s: %.2f (n=%d) · others: %.2f (n=%d)", opt, mean(a), length(a), mean(b), length(b)))
        }
      }
    }
  }
  if (!length(rows)) return(list())
  df <- dplyr::bind_rows(rows)
  df$p_adj <- stats::p.adjust(df$p, method = "BH")
  df$magnitude <- dplyr::case_when(
    df$effect_name == "r"  & df$effect >= 0.5  ~ "large",
    df$effect_name == "r"  & df$effect >= 0.3  ~ "medium",
    df$effect_name == "r"  & df$effect >= 0.1  ~ "small",
    df$effect_name == "ε²" & df$effect >= 0.26 ~ "large",
    df$effect_name == "ε²" & df$effect >= 0.08 ~ "medium",
    df$effect_name == "ε²" & df$effect >= 0.01 ~ "small",
    TRUE ~ "negligible")
  df
}

compute_stats <- function(d) {
  v <- d[d$eligible, ]
  attr(v, "activity_matrix") <- attr(d, "activity_matrix")[d$eligible, , drop = FALSE]
  attr(v, "circumstance_matrix") <- attr(d, "circumstance_matrix")[d$eligible, , drop = FALSE]
  rel <- c(lapply(setNames(names(THEMES), names(THEMES)),
                  function(t) reliability(v, ITEMS$item[ITEMS$theme == t])),
           list(overall = reliability(v, ITEMS$item)))
  m <- as.matrix(v[paste0("r_", ITEMS$item)])
  cm <- if (nrow(v) >= 3) suppressWarnings(cor(m, use = "pairwise.complete.obs")) else NULL
  if (!is.null(cm)) cm[!is.finite(cm)] <- NA
  list(reliability = rel, item_cor = cm, tests = group_tests(v), n = nrow(v))
}
