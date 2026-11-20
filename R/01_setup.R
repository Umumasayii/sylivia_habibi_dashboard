# -----------------------------------------------------------------------------
# 01_setup.R — packages, constants and the survey's scoring rules
# -----------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(readxl)
  library(readr)
  library(dplyr)
  library(tidyr)
  library(stringr)
  library(purrr)
  library(plotly)
  library(DT)
  library(crosstalk)
  library(htmltools)
  library(htmlwidgets)
  library(jsonlite)
})

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

# ---- Themes (5 domains of self-understanding) --------------------------------
THEMES <- c(
  identity = "Who I am",
  social   = "Myself among others",
  feedback = "Strengths, criticism and mistakes",
  values   = "Values and actions",
  reflect  = "Emotions and reflection"
)

# ---- The 21 statements: Q6–Q26 (S1–S21 in the first form version) -----------
ITEMS <- tibble::tibble(
  item  = paste0("q", 6:26),
  num   = 6:26,
  short = c(
    "Hard to describe myself beyond roles or achievements",
    "Unsure what would remain if I lost an important role",
    "Self-understanding changes with what others say",
    "Wonder if I truly wanted a decision or followed expectations",
    "Recognise what makes me different without ranking myself",
    "Present very different versions of myself across groups",
    "Copy others to feel accepted",
    "What I say I want changes with who I talk to",
    "Made important choices to avoid disappointing someone",
    "Know which beliefs are my own even when unpopular",
    "Identify my strengths and limitations without help",
    "First reaction to criticism is to defend myself",
    "Try to appear strong even when struggling",
    "Pause and examine an unfamiliar description of me",
    "Admit I was wrong without being defined by it",
    "Can name and explain my guiding values",
    "Recent actions reflect my stated values",
    "Recognise when behaviour goes against my values",
    "Identify what triggered a strong emotion",
    "Make time to examine choices and patterns",
    "Know if an argument protects values or pride"
  ),
  theme = rep(names(THEMES), times = c(5, 5, 5, 3, 3)),
  # agreement with these items indicates LESS self-clarity -> reverse scored
  reverse = num %in% c(6:9, 11:14, 17, 18)
) |>
  mutate(theme_label = THEMES[theme],
         label = paste0("Q", num, " · ", short))

LIKERT_LEVELS <- c("Strongly disagree", "Disagree", "Agree", "Strongly agree", "Not sure")
LIKERT_SCORE  <- c("Strongly disagree" = 1, "Disagree" = 2, "Agree" = 3, "Strongly agree" = 4)

AGE_LEVELS  <- c("Under 18", "18–24", "25–34", "35–44", "45–50", "Over 50", "Prefer not to say")
AGE_VALID   <- c("18–24", "25–34", "35–44", "45–50")

# Multiple-choice options: display label = regex that detects it in the export
# (works for label exports, XML-value exports and both form versions)
ACTIVITY_OPTS <- c(
  "Studying"                              = "studying",
  "Employed full-time"                    = "(^|[^f])employed.full",
  "Employed part-time"                    = "(^|[^f])employed.part",
  "Self-employed / running a business"    = "self.employed",
  "Unemployed, looking for work"          = "unemployed",
  "Working mother"                        = "working.mother",
  "Stay-at-home mother"                   = "stay.(at.)?home.mother",
  "Working father"                        = "working.father",
  "Stay-at-home father"                   = "stay.(at.)?home.father",
  "More than one applies equally"         = "more than one",
  "Other"                                 = "(^|\\s)other"
)
CIRCUMSTANCE_OPTS <- c(
  "Single"                                 = "i am single",
  "Dating / in a relationship"             = "dating|in a relationship",
  "Married"                                = "i am married",
  "Separated, divorced or widowed"         = "separated|divorced|widowed",
  "Parent"                                 = "i am a parent",
  "Significant caregiving"                 = "caregiving",
  "Educational or career transition"       = "educational or career",
  "Other personal transition"              = "another significant personal",
  "None of these"                          = "none of these"
)

# ---- Chart colours (validated reference palette, light mode) ----------------
THEME_COL <- c(identity = "#2a78d6", social = "#eb6834", feedback = "#1baf7a",
               values = "#eda100", reflect = "#e87ba4")
LIKERT_COL <- c("Strongly disagree" = "#c23b3b", "Disagree" = "#ec9a95",
                "Agree" = "#86b6ef", "Strongly agree" = "#1c5cab", "Not sure" = "#c3c2b7")
BLUE  <- "#2a78d6"
INK   <- "#0b0b0b"; INK2 <- "#52514e"; MUTED <- "#898781"; GRID <- "#e1e0d9"
