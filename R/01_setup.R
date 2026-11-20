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
  "Employed full-time"                    = "(^|[^f-])employed.f(ull|t)",
  "Employed part-time"                    = "(^|[^f-])employed.p(art|t)",
  "Self-employed / running a business"    = "self.employed",
  "Unemployed, looking for work"          = "unemployed",
  "Working mother"                        = "working.mother",
  "Stay-at-home mother"                   = "stay.(at.)?home.mother",
  "Working father"                        = "working.father",
  "Stay-at-home father"                   = "stay.(at.)?home.father",
  "More than one applies equally"         = "more than one|multiple equal",
  "Other"                                 = "(^|\\s)other"
)
CIRCUMSTANCE_OPTS <- c(
  "Single"                                 = "(^|\\s)(i am )?single(\\s|$)",
  "Dating / in a relationship"             = "dating|(^|\\s)relationship(\\s|$)",
  "Married"                                = "(^|\\s)(i am )?married(\\s|$)",
  "Separated, divorced or widowed"         = "separated|divorced|widowed|sep div wid",
  "Parent"                                 = "(^|\\s)(i am a )?parent(\\s|$)",
  "Significant caregiving"                 = "caregiv",
  "Educational or career transition"       = "educational or career|edu career",
  "Other personal transition"              = "another significant personal|(^|\\s)personal transition",
  "None of these"                          = "none of these"
)


# Full statement wording (as shown to respondents)
STATEMENT_TEXT <- c(
  "When someone asks me to describe who I am, I find it difficult to know what to say beyond my roles, responsibilities, or achievements.",
  "When I imagine losing an important role, such as my job, relationship, or position in the family, I am unsure what would remain of my identity.",
  "My understanding of who I am changes considerably depending on what other people say or think about me.",
  "After making an important decision, I sometimes wonder, “Did I genuinely want this, or was I influenced by what others expected?”",
  "I can recognise the qualities that make me different from people around me without needing to see myself as better or worse than them.",
  "I notice that I present very different versions of myself depending on whether I am with family, friends, colleagues, or other groups.",
  "I sometimes copy how other people speak, dress, behave, or express opinions because I want to feel accepted.",
  "What I say I want can change depending on who I am talking to at the time.",
  "I have made important choices in relationships, work, or life mainly because I did not want to disappoint someone.",
  "Even when my opinion is unpopular, I can recognise which thoughts and beliefs are genuinely my own.",
  "I can identify my strengths and limitations without needing someone else to point them out first.",
  "When someone criticises me, my first reaction is usually to defend myself rather than consider whether the criticism may be useful.",
  "I try to appear strong and in control, even when I am struggling, uncertain, or in need of help.",
  "When someone describes me in a way I do not recognise, I can pause and examine their perspective before accepting or rejecting it.",
  "I can admit that I was wrong without feeling that the mistake defines who I am.",
  "I can name the personal values that guide my decisions and explain why those values matter to me.",
  "Looking back at my recent choices, my actions generally reflect the values I say are important to me.",
  "When my behaviour goes against my values, I can recognise the inconsistency instead of immediately justifying it.",
  "I can usually identify what triggered a strong emotion, such as anger, frustration, fear, jealousy, excitement, or happiness.",
  "I intentionally make time to examine my choices, emotions, and recurring patterns, even when no one else will know that I have done so.",
  "When I am in an argument, I can easily know if it is to protect my values or to protect my pride."
)
