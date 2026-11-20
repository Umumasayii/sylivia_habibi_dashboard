#!/usr/bin/env Rscript
# -----------------------------------------------------------------------------
# build_dashboard.R — run this to (re)build the dashboard
#
#   Rscript build_dashboard.R                 # uses the export found in data/
#   Rscript build_dashboard.R path/to/file.xlsx
#
# Output: public/index.html (+ public/lib, public/assets, public/data)
# -----------------------------------------------------------------------------

args <- commandArgs(trailingOnly = TRUE)
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f, encoding = "UTF-8")

data_file <- if (length(args)) args[[1]] else find_data_file("data")
message("Reading: ", data_file)

raw <- read_any(data_file)
d   <- clean_survey(raw) |> score_survey()
a   <- analyse(d)
message(sprintf("Submissions: %d · analysed: %d", a$n_all, a$n_valid))

# Fresh output folder
unlink("public", recursive = TRUE)
dir.create("public/assets", recursive = TRUE)
dir.create("public/data", recursive = TRUE)
invisible(file.copy(list.files("assets", full.names = TRUE), "public/assets", overwrite = TRUE))

# Processed data for download
a$valid |>
  select(id, date, age_group, lives_rwanda, consent, activity = activity_list,
         circumstances = circumstances_list, activity_other, all_of(ITEMS$item),
         all_of(paste0("r_", ITEMS$item)), starts_with("score_"), n_not_sure, n_answered,
         duration_min, comments) |>
  readr::write_csv("public/data/respondent_scores.csv", na = "")
a$items |> select(item, num, short, theme = theme_label, reverse, n_answered, pct_agree,
                  pct_not_sure, mean_raw, mean_scored, lo, hi, sd) |>
  mutate(across(where(is.double), ~ round(.x, 3))) |>
  readr::write_csv("public/data/statement_summary.csv", na = "")
a$themes |> mutate(across(where(is.numeric), ~ round(.x, 3))) |> readr::write_csv("public/data/theme_summary.csv", na = "")

page <- build_page(a, data_file)
htmltools::save_html(page, file = "public/index.html", libdir = "lib")
message("Dashboard written to public/index.html")
