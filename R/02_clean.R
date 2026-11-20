# -----------------------------------------------------------------------------
# 02_clean.R — read any KoBo export and standardise it
#   * .xlsx / .xls / .csv (comma or semicolon)
#   * "Labels" or "XML values and headers", with or without group prefixes
#   * both form versions (S1–S21 and Q6–Q26), merged per respondent
# -----------------------------------------------------------------------------

find_data_file <- function(dir = "data") {
  f <- list.files(dir, pattern = "\\.(xlsx|xls|csv)$", full.names = TRUE, ignore.case = TRUE)
  f <- f[!grepl("^~\\$", basename(f))]
  if (!length(f)) stop("No .xlsx/.xls/.csv file found in '", dir, "/'. Put the KoBo export there.")
  if (length(f) > 1) message("Several data files found; using the last one alphabetically: ", basename(sort(f)[length(f)]))
  sort(f)[length(f)]
}

read_any <- function(path) {
  ext <- tolower(tools::file_ext(path))
  if (ext == "json") return(read_kobo_json(path))
  if (ext %in% c("xlsx", "xls")) {
    raw <- readxl::read_excel(path, sheet = 1, col_types = "text", .name_repair = "minimal")
  } else {
    first <- readLines(path, n = 1, warn = FALSE, encoding = "UTF-8")
    delim <- if (str_count(first, ";") > str_count(first, ",")) ";" else ","
    raw <- readr::read_delim(path, delim = delim, col_types = readr::cols(.default = "c"),
                             name_repair = "minimal", show_col_types = FALSE)
  }
  as.data.frame(raw, check.names = FALSE, stringsAsFactors = FALSE)
}

# KoBoToolbox API (v2) JSON: a list of submissions, keys like "group/question"
read_kobo_json <- function(path) {
  x <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  if (!is.null(x$results)) x <- x$results
  keys <- unique(unlist(lapply(x, names)))
  if (!length(x) || !length(keys)) return(data.frame(`_uuid` = character(0), check.names = FALSE))
  cols <- lapply(keys, function(k) vapply(x, function(r) {
    v <- r[[k]]
    if (is.null(v) || !length(v)) NA_character_ else if (is.list(v)) paste(unlist(v), collapse = " ") else paste(v, collapse = " ")
  }, character(1)))
  as.data.frame(setNames(cols, keys), check.names = FALSE, stringsAsFactors = FALSE)
}

blank_to_na <- function(x) { x <- trimws(as.character(x)); x[x %in% c("", "NA", "n/a")] <- NA; x }

# Return the first non-missing value per row across all columns whose header
# matches `pattern` (full header or its last path segment for XML headers).
pick <- function(raw, pattern) {
  nm   <- names(raw); nm[is.na(nm)] <- ""
  base <- ifelse(grepl("^[A-Za-z0-9_]+(/[A-Za-z0-9_]+)+$", nm), sub(".*/", "", nm), nm)
  idx  <- which(grepl(pattern, nm, perl = TRUE, ignore.case = TRUE) |
                grepl(pattern, base, perl = TRUE, ignore.case = TRUE))
  out <- rep(NA_character_, nrow(raw))
  for (i in idx) { v <- blank_to_na(raw[[i]]); out <- ifelse(is.na(out), v, out) }
  out
}

# Rebuild a multiple-choice answer string from KoBo's 0/1 option columns
pick_multi <- function(raw, text_pattern, option_pattern) {
  txt <- pick(raw, text_pattern)
  nm  <- names(raw); nm[is.na(nm)] <- ""
  idx <- which(grepl(option_pattern, nm, perl = TRUE, ignore.case = TRUE))
  if (length(idx)) {
    opt <- sub(option_pattern, "\\1", nm[idx], perl = TRUE, ignore.case = TRUE)
    from_bin <- vapply(seq_len(nrow(raw)), function(r) {
      on <- vapply(idx, function(i) blank_to_na(raw[[i]][r]) %in% c("1", "TRUE", "True", "true"), logical(1))
      if (any(on)) paste(opt[on], collapse = " | ") else NA_character_
    }, character(1))
    txt <- ifelse(is.na(txt), from_bin, txt)
  }
  txt
}

parse_time <- function(x) {
  x <- blank_to_na(x)
  num <- suppressWarnings(as.numeric(x))
  out <- as.POSIXct(rep(NA_real_, length(x)), origin = "1970-01-01", tz = "UTC")
  is_serial <- !is.na(num) & num > 20000 & num < 80000
  out[is_serial] <- as.POSIXct((num[is_serial] - 25569) * 86400, origin = "1970-01-01", tz = "UTC")
  s <- sub("T", " ", x[!is_serial]); s <- substr(s, 1, 19)
  out[!is_serial] <- as.POSIXct(s, format = "%Y-%m-%d %H:%M:%S", tz = "UTC")
  out
}

norm_age <- function(x) {
  l <- tolower(gsub("_", " ", x))
  case_when(
    is.na(l)                        ~ NA_character_,
    grepl("under", l)               ~ "Under 18",
    grepl("18\\D*24", l)            ~ "18–24",
    grepl("25\\D*34", l)            ~ "25–34",
    grepl("35\\D*44", l)            ~ "35–44",
    grepl("45\\D*50", l)            ~ "45–50",
    grepl("over", l)                ~ "Over 50",
    grepl("prefer|pns", l)          ~ "Prefer not to say",
    TRUE                            ~ x
  )
}

norm_likert <- function(x) {
  l <- tolower(trimws(gsub("_", " ", x)))
  case_when(
    l %in% c("strongly agree", "4")    ~ "Strongly agree",
    l %in% c("agree", "3")             ~ "Agree",
    l %in% c("disagree", "2")          ~ "Disagree",
    l %in% c("strongly disagree", "1") ~ "Strongly disagree",
    l %in% c("not sure", "9")          ~ "Not sure",
    TRUE                               ~ NA_character_
  )
}

detect_options <- function(text, opts) {
  l <- tolower(gsub("_", " ", text))
  m <- vapply(opts, function(p) !is.na(l) & grepl(p, l, perl = TRUE), logical(length(l)))
  if (is.null(dim(m))) m <- matrix(m, nrow = length(l), dimnames = list(NULL, names(opts)))
  m
}

clean_survey <- function(raw) {
  n <- nrow(raw)
  d <- tibble::tibble(
    id         = pick(raw, "^_uuid$|^meta/instanceID$|^_id$") %||% NA,
    start      = parse_time(pick(raw, "^start$")),
    end        = parse_time(pick(raw, "^end$")),
    submitted  = parse_time(pick(raw, "^_submission_time$")),
    age_group  = norm_age(pick(raw, "^age_group$|^1\\.\\s*What is your age group")),
    lives_raw  = pick(raw, "^lives_rwanda$|^2\\.\\s*Do you currently live in Rwanda"),
    consent_raw= pick(raw, "^consent$|^3\\.\\s*Do you voluntarily agree"),
    activity   = pick_multi(raw,
                   "^(primary_)?activity$|^4\\.\\s*What is your current primary activity\\?$",
                   "^4\\.\\s*What is your current primary activity\\?/(.+)$"),
    activity_other = pick(raw, "^(primary_)?activity_other$|^Please specify (the|your) other|^4a\\."),
    circumstances  = pick_multi(raw,
                   "^(current_circumstances|circumstance)$|^5\\.\\s*Which of the following currently applies to you\\?(\\.1)?$",
                   "^5\\.\\s*Which of the following currently applies to you\\?/(.+)$"),
    comments   = pick(raw, "^(comments|reflection)$|^27\\.|^Is there anything else you would like to share")
  )
  if (all(is.na(d$id))) d$id <- as.character(seq_len(n))
  d$id[is.na(d$id)] <- paste0("row", which(is.na(d$id)))
  d$id <- make.unique(d$id)

  for (k in 6:26) {
    pat <- sprintf("^q%d$|^%d\\.\\s|^\\*\\*S%d\\.\\*\\*|^s%02d$", k, k, k - 5, k - 5)
    d[[paste0("q", k)]] <- norm_likert(pick(raw, pat))
  }

  d <- d |>
    mutate(
      lives_rwanda = case_when(tolower(lives_raw) == "yes" ~ "Yes", tolower(lives_raw) == "no" ~ "No"),
      consent = case_when(grepl("^(i )?agree", tolower(consent_raw)) ~ "Agreed",
                          grepl("not agree|disagree", tolower(consent_raw)) ~ "Did not agree"),
      age_group = factor(age_group, levels = AGE_LEVELS),
      age_ok    = age_group %in% AGE_VALID,
      eligible  = age_ok & lives_rwanda %in% "Yes" & consent %in% "Agreed",
      duration_min = as.numeric(difftime(end, start, units = "mins")),
      date = as.Date(coalesce(submitted, end, start))
    ) |>
    select(-lives_raw, -consent_raw)

  act  <- detect_options(d$activity, ACTIVITY_OPTS)
  circ <- detect_options(d$circumstances, CIRCUMSTANCE_OPTS)
  d$activity_list      <- apply(act,  1, function(r) paste(colnames(act)[r],  collapse = "; "))
  d$circumstances_list <- apply(circ, 1, function(r) paste(colnames(circ)[r], collapse = "; "))
  attr(d, "activity_matrix") <- act
  attr(d, "circumstance_matrix") <- circ
  d
}

score_survey <- function(d) {
  for (k in 6:26) {
    q <- paste0("q", k); v <- unname(LIKERT_SCORE[d[[q]]])
    d[[paste0("r_", q)]] <- if (k %in% ITEMS$num[ITEMS$reverse]) 5 - v else v
  }
  rowmean <- function(cols) { m <- rowMeans(as.matrix(d[cols]), na.rm = TRUE); m[is.nan(m)] <- NA; round(m, 2) }
  for (t in names(THEMES)) d[[paste0("score_", t)]] <- rowmean(paste0("r_", ITEMS$item[ITEMS$theme == t]))
  d$score_overall <- rowmean(paste0("r_", ITEMS$item))
  d$n_not_sure <- rowSums(as.matrix(d[ITEMS$item]) == "Not sure", na.rm = TRUE)
  d$n_answered <- rowSums(!is.na(as.matrix(d[ITEMS$item])))

  # ---- Data-quality flags (used on the Data quality page) -------------------
  ans <- as.matrix(d[ITEMS$item])
  d$n_distinct <- apply(ans, 1, function(r) length(unique(r[!is.na(r)])))
  d$flag_speeder      <- !is.na(d$duration_min) & d$duration_min < 3
  d$flag_straightline <- d$n_answered >= 15 & d$n_distinct == 1
  d$flag_not_sure     <- d$n_not_sure >= 6
  d$flag_incomplete   <- d$eligible & d$n_answered < nrow(ITEMS)
  d$flag_duplicate    <- duplicated(d$id) | duplicated(d$id, fromLast = TRUE)
  d$inelig_reason <- dplyr::case_when(
    d$eligible ~ "",
    is.na(d$age_group) ~ "Age not given",
    !d$age_ok ~ "Outside 18–50",
    !(d$lives_rwanda %in% "Yes") ~ "Not living in Rwanda",
    !(d$consent %in% "Agreed") ~ "No consent",
    TRUE ~ "Other"
  )
  d
}
