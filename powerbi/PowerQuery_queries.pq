// =============================================================================
// Power Query (M) for the "Knowing and Living the Self" Power BI report
//
// HOW TO USE (Power BI Desktop):
//   1. Home > Transform data > Power Query Editor.
//   2. Home > New source > Blank query. Name it exactly as the heading below
//      (e.g. BaseUrl, respondents, answers ...).
//   3. Home > Advanced editor > replace everything with the code under that
//      heading > Done. Repeat for every query in this file.
//   4. Close & Apply. The first time, choose "Anonymous" when asked how to
//      connect to raw.githubusercontent.com.
//
// The CSV files are produced by R (R/05_powerbi.R) on every dashboard update
// and published in the public GitHub repository.
// =============================================================================

// ----------------------------------------------------------------- BaseUrl
// (Blank query named BaseUrl. Text value only; Power BI treats it as a constant.)
"https://raw.githubusercontent.com/Umumasayii/sylivia_habibi_dashboard/main/public/data/powerbi/"

// ----------------------------------------------------------------- respondents
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "respondents.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"submitted_date", type date},
            {"age_group", type text},
            {"age_order", Int64.Type},
            {"main_activity", type text},
            {"n_activities", Int64.Type},
            {"n_circumstances", Int64.Type},
            {"score_identity", type number},
            {"score_social", type number},
            {"score_feedback", type number},
            {"score_values", type number},
            {"score_reflect", type number},
            {"score_overall", type number},
            {"overall_level", type text},
            {"n_not_sure", Int64.Type},
            {"n_answered", Int64.Type},
            {"duration_min", type number},
            {"has_comment", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- answers
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "answers.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"item", type text},
            {"answer", type text},
            {"answer_code", Int64.Type},
            {"score", type number},
            {"answer_order", Int64.Type},
            {"agree", Int64.Type},
            {"not_sure", Int64.Type}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- theme_scores
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "theme_scores.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"theme", type text},
            {"score", type number},
            {"level", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- respondent_activity
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "respondent_activity.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"activity", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- respondent_circumstance
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "respondent_circumstance.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"circumstance", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- items
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "items.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"item", type text},
            {"item_num", Int64.Type},
            {"item_label", type text},
            {"statement_short", type text},
            {"statement", type text},
            {"theme", type text},
            {"reverse_scored", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- themes
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "themes.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"theme", type text},
            {"theme_label", type text},
            {"theme_order", Int64.Type}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- submissions
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "submissions.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"submitted_date", type date},
            {"age_group", type text},
            {"age_eligible", type text},
            {"lives_rwanda", type text},
            {"consent", type text},
            {"analysed", type text},
            {"not_analysed_reason", type text},
            {"duration_min", type number},
            {"flag_speeder", type text},
            {"flag_straightline", type text},
            {"flag_many_not_sure", type text},
            {"flag_incomplete", type text},
            {"flag_duplicate", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- comments
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "comments.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"id", type text},
            {"submitted_date", type date},
            {"age_group", type text},
            {"comment", type text}
        }, "en-US")
in
    Typed

// ----------------------------------------------------------------- meta
let
    Source   = Csv.Document(
                   Web.Contents(BaseUrl, [RelativePath = "meta.csv"]),
                   [Delimiter = ",", Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),
    Headers  = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    Blanks   = Table.TransformColumns(Headers, {}, each if _ = "" then null else _),
    Typed    = Table.TransformColumnTypes(Blanks, {
            {"last_updated_utc", type datetime},
            {"source", type text},
            {"submissions", Int64.Type},
            {"analysed", Int64.Type}
        }, "en-US")
in
    Typed
