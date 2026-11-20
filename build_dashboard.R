#!/usr/bin/env Rscript
# -----------------------------------------------------------------------------
# build_dashboard.R — run this to (re)build the dashboard
#
#   Rscript build_dashboard.R                 # uses the export found in data/
#   Rscript build_dashboard.R path/to/file.xlsx
#
# R does the cleaning, scoring and statistics, then writes public/data/.
# The web app in site/ is copied to public/ and reads that data.
# -----------------------------------------------------------------------------

args <- commandArgs(trailingOnly = TRUE)
for (f in sort(list.files("R", pattern = "\\.R$", full.names = TRUE))) source(f, encoding = "UTF-8")

data_file <- if (length(args)) args[[1]] else find_data_file("data")
message("Reading: ", data_file)

d  <- read_any(data_file) |> clean_survey() |> score_survey()
st <- compute_stats(d)
message(sprintf("Submissions: %d · analysed: %d · group tests: %d",
                nrow(d), sum(d$eligible), NROW(st$tests)))

unlink("public", recursive = TRUE)
dir.create("public", showWarnings = FALSE)
invisible(file.copy(list.files("site", full.names = TRUE, all.files = FALSE), "public", recursive = TRUE))
export_dashboard(d, st, data_file, "public/data")
export_powerbi(d, "public/data/powerbi")
if (nzchar(Sys.getenv("KOBO_HASH"))) writeLines(Sys.getenv("KOBO_HASH"), "public/data/source_hash.txt")
message("Dashboard written to public/")
