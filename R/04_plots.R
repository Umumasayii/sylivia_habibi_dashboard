# -----------------------------------------------------------------------------
# 04_plots.R — interactive charts (plotly) and tables (DT)
# -----------------------------------------------------------------------------

FONT <- list(family = "system-ui, -apple-system, 'Segoe UI', sans-serif", size = 12, color = INK2)

no_data <- function(msg = "Not enough eligible responses yet to show this chart.")
  div(class = "empty", msg)

safe <- function(expr, msg = NULL) tryCatch(expr, error = function(e) {
  message("Chart skipped: ", conditionMessage(e)); no_data(msg %||% "This chart could not be drawn with the current data.")
})

style_plot <- function(p, height = 360, xtitle = NULL, ytitle = NULL, legend = TRUE, l = 60) {
  p |>
    layout(font = FONT, paper_bgcolor = "rgba(0,0,0,0)", plot_bgcolor = "rgba(0,0,0,0)",
           margin = list(l = l, r = 20, t = 10, b = 50),
           xaxis = list(title = list(text = xtitle %||% ""), gridcolor = GRID, zerolinecolor = "#c3c2b7", linecolor = "#c3c2b7"),
           yaxis = list(title = list(text = ytitle %||% ""), gridcolor = GRID, zerolinecolor = "#c3c2b7", linecolor = "#c3c2b7"),
           showlegend = legend,
           legend = list(orientation = "h", x = 0, y = 1.08, yanchor = "bottom", font = list(color = INK2)),
           hoverlabel = list(bgcolor = "#ffffff", bordercolor = GRID, font = list(color = INK)),
           bargap = 0.25) |>
    config(displaylogo = FALSE, responsive = TRUE,
           modeBarButtonsToRemove = c("lasso2d", "select2d", "autoScale2d"),
           toImageButtonOptions = list(format = "png", scale = 2)) |>
    (\(w) { w$height <- height; w$sizingPolicy$browser$fill <- FALSE; w })()
}

dt_table <- function(df, page = 10, ...) {
  DT::datatable(df, rownames = FALSE, extensions = "Buttons", class = "compact stripe hover",
                options = list(dom = "Bfrtip", buttons = c("copy", "csv", "excel"),
                               pageLength = page, scrollX = TRUE, autoWidth = FALSE, ...))
}

# ---- Overview ---------------------------------------------------------------
plot_funnel <- function(a) {
  f <- a$funnel
  plot_ly(f, type = "funnel", y = ~stage, x = ~n, textinfo = "value+percent initial",
          marker = list(color = c("#86b6ef", "#5598e7", "#2a78d6", "#1c5cab")),
          connector = list(fillcolor = "#f0efec"),
          hovertemplate = "%{y}: %{x} people<extra></extra>") |>
    style_plot(height = 300, legend = FALSE, l = 170) |>
    layout(yaxis = list(categoryorder = "array", categoryarray = rev(f$stage)))
}

plot_by_date <- function(a) {
  if (!nrow(a$by_date)) return(no_data("No submission dates found."))
  plot_ly(a$by_date, x = ~date, y = ~n, type = "bar", marker = list(color = BLUE),
          hovertemplate = "%{x|%d %b %Y}: %{y} submissions<extra></extra>") |>
    style_plot(height = 300, ytitle = "Submissions", legend = FALSE) |>
    layout(xaxis = list(type = "date", tickformat = "%d %b", dtick = 86400000))
}

plot_hist <- function(x, xtitle, nbins = 20, color = BLUE, height = 300) {
  x <- x[!is.na(x)]
  if (!length(x)) return(no_data())
  plot_ly(x = x, type = "histogram", nbinsx = nbins, marker = list(color = color, line = list(color = "#fcfcfb", width = 1)),
          hovertemplate = "%{x}: %{y} respondents<extra></extra>") |>
    style_plot(height = height, xtitle = xtitle, ytitle = "Respondents", legend = FALSE)
}

# ---- Participants -----------------------------------------------------------
plot_bar_h <- function(df, label_col, xtitle = "% of analysed respondents", height = NULL) {
  if (!nrow(df) || all(df$n == 0)) return(no_data())
  df <- df |> arrange(pct)
  plot_ly(df, y = as.formula(paste0("~`", label_col, "`")), x = ~pct, type = "bar", orientation = "h",
          marker = list(color = BLUE), text = ~paste0(n), textposition = "outside",
          textfont = list(color = INK2),
          hovertemplate = "%{y}<br>%{x:.1f}% (%{text} people)<extra></extra>") |>
    style_plot(height = height %||% (90 + 30 * nrow(df)), xtitle = xtitle, legend = FALSE, l = 230) |>
    layout(yaxis = list(categoryorder = "array", categoryarray = df[[label_col]]))
}

plot_age <- function(a) {
  df <- a$age
  if (sum(df$n) == 0) return(no_data())
  plot_ly(df, x = ~age_group, y = ~n, type = "bar", marker = list(color = BLUE),
          text = ~sprintf("%.0f%%", pct), textposition = "outside", textfont = list(color = INK2),
          hovertemplate = "%{x}: %{y} people (%{text})<extra></extra>") |>
    style_plot(height = 300, ytitle = "Respondents", legend = FALSE)
}

# ---- Statements ---------------------------------------------------------------
plot_likert <- function(a) {
  lk <- a$likert |> filter(answer != "Not sure")
  if (sum(lk$n) == 0) return(no_data())
  order_lab <- ITEMS$label
  p <- plot_ly()
  spec <- list(list("Disagree", -1, 2), list("Strongly disagree", -1, 1),
               list("Agree", 1, 3), list("Strongly agree", 1, 4))
  for (s in spec) {
    dd <- lk |> filter(answer == s[[1]]) |> mutate(xval = pct_sub * s[[2]])
    p <- p |> add_trace(data = dd, y = ~label, x = ~xval, type = "bar", orientation = "h",
                        name = s[[1]], legendrank = s[[3]], marker = list(color = LIKERT_COL[[s[[1]]]]),
                        customdata = ~paste0(round(pct_sub), "% (", n, ")"),
                        hovertemplate = paste0("%{y}<br>", s[[1]], ": %{customdata}<extra></extra>"))
  }
  p |> style_plot(height = 140 + 28 * nrow(ITEMS), xtitle = "% of answers (excluding Not sure)", l = 380) |>
    layout(barmode = "relative",
           xaxis = list(range = c(-100, 100), tickvals = seq(-100, 100, 25),
                        ticktext = paste0(abs(seq(-100, 100, 25)), "%")),
           yaxis = list(categoryorder = "array", categoryarray = rev(order_lab), title = list(text = "")),
           shapes = list(list(type = "line", x0 = 0, x1 = 0, y0 = 0, y1 = 1, yref = "paper",
                              line = list(color = INK2, width = 1))))
}

plot_not_sure <- function(a) {
  it <- a$items |> filter(!is.na(pct_not_sure))
  if (!nrow(it)) return(no_data())
  plot_ly(it, y = ~label, x = ~pct_not_sure, type = "bar", orientation = "h",
          marker = list(color = "#898781"),
          hovertemplate = "%{y}<br>Not sure: %{x:.0f}%<extra></extra>") |>
    style_plot(height = 140 + 28 * nrow(ITEMS), xtitle = "% answering Not sure", legend = FALSE, l = 380) |>
    layout(yaxis = list(categoryorder = "array", categoryarray = rev(ITEMS$label), title = list(text = "")),
           xaxis = list(rangemode = "tozero"))
}

plot_item_means <- function(a) {
  it <- a$items |> filter(!is.na(mean_scored))
  if (!nrow(it)) return(no_data())
  p <- plot_ly()
  for (t in names(THEMES)) {
    dd <- it |> filter(theme == t); if (!nrow(dd)) next
    p <- p |> add_trace(data = dd, y = ~label, x = ~mean_scored, type = "scatter", mode = "markers",
                        name = THEMES[[t]], marker = list(color = THEME_COL[[t]], size = 11, line = list(color = "#fcfcfb", width = 2)),
                        error_x = list(type = "data", symmetric = FALSE, array = ~hi - mean_scored,
                                       arrayminus = ~mean_scored - lo, color = THEME_COL[[t]], thickness = 1.5, width = 0),
                        customdata = ~ifelse(reverse, "reverse-scored", "scored as answered"),
                        hovertemplate = "%{y}<br>Mean score %{x:.2f} (%{customdata})<extra></extra>")
  }
  p |> style_plot(height = 160 + 28 * nrow(ITEMS), xtitle = "Mean item score (1 = least, 4 = clearest self-understanding)", l = 380) |>
    layout(xaxis = list(range = c(0.8, 4.2), dtick = 0.5),
           yaxis = list(categoryorder = "array", categoryarray = rev(ITEMS$label), title = list(text = "")))
}

# ---- Theme scores -----------------------------------------------------------
plot_theme_means <- function(a) {
  th <- a$themes |> filter(!is.na(mean))
  if (!nrow(th)) return(no_data())
  th$label <- factor(th$label, levels = rev(THEMES))
  plot_ly(th, y = ~label, x = ~mean, type = "bar", orientation = "h",
          marker = list(color = unname(THEME_COL[th$theme])),
          error_x = list(type = "data", symmetric = FALSE, array = ~ifelse(is.na(hi), 0, hi - mean),
                         arrayminus = ~ifelse(is.na(lo), 0, mean - lo), color = INK2, thickness = 1.5, width = 6),
          text = ~sprintf("%.2f", mean), textposition = "inside", insidetextanchor = "start",
          textfont = list(color = "#ffffff"),
          customdata = ~n,
          hovertemplate = "%{y}<br>Mean %{x:.2f} (n = %{customdata})<extra></extra>") |>
    style_plot(height = 300, xtitle = "Mean score (1–4), with 95% confidence interval", legend = FALSE, l = 230) |>
    layout(xaxis = list(range = c(0, 4.2), dtick = 1))
}

plot_theme_box <- function(a) {
  v <- a$valid
  if (!nrow(v)) return(no_data())
  p <- plot_ly()
  for (t in names(THEMES)) {
    p <- p |> add_trace(y = v[[paste0("score_", t)]], type = "box", name = THEMES[[t]],
                        boxpoints = "all", jitter = 0.4, pointpos = 0,
                        marker = list(color = THEME_COL[[t]], size = 7, opacity = 0.7),
                        line = list(color = THEME_COL[[t]]), fillcolor = "rgba(0,0,0,0)",
                        hoverinfo = "y")
  }
  p |> style_plot(height = 380, ytitle = "Score (1–4)", legend = FALSE) |>
    layout(yaxis = list(range = c(0.8, 4.2)))
}

plot_by_age <- function(a) {
  df <- a$by_age
  if (!nrow(df)) return(no_data())
  p <- plot_ly()
  for (t in names(THEMES)) {
    p <- p |> add_trace(data = df, x = ~age_group, y = as.formula(paste0("~score_", t)), type = "bar",
                        name = THEMES[[t]], marker = list(color = THEME_COL[[t]]), customdata = ~n,
                        hovertemplate = paste0(THEMES[[t]], "<br>%{x}: %{y:.2f} (n = %{customdata})<extra></extra>"))
  }
  p |> style_plot(height = 380, ytitle = "Mean score (1–4)") |>
    layout(barmode = "group", yaxis = list(range = c(0, 4.2)))
}

plot_score_by_group <- function(df) {
  df <- df |> filter(!is.na(mean))
  if (!nrow(df)) return(no_data())
  df <- df |> arrange(mean)
  plot_ly(df, y = ~option, x = ~mean, type = "scatter", mode = "markers",
          marker = list(color = BLUE, size = 11, line = list(color = "#fcfcfb", width = 2)),
          error_x = list(type = "data", symmetric = FALSE, array = ~ifelse(is.na(hi), 0, hi - mean),
                         arrayminus = ~ifelse(is.na(lo), 0, mean - lo), color = BLUE, thickness = 1.5, width = 0),
          customdata = ~n,
          hovertemplate = "%{y}<br>Mean overall score %{x:.2f} (n = %{customdata})<extra></extra>") |>
    style_plot(height = 90 + 32 * nrow(df), xtitle = "Mean overall score (1–4)", legend = FALSE, l = 230) |>
    layout(xaxis = list(range = c(0.8, 4.2)),
           yaxis = list(categoryorder = "array", categoryarray = df$option, title = list(text = "")))
}

plot_cor <- function(a) {
  m <- a$cor
  if (is.null(m)) return(no_data("Correlations need at least 3 respondents with all theme scores."))
  lab <- unname(THEMES[sub("score_", "", colnames(m))])
  plot_ly(x = lab, y = lab, z = round(m, 2), type = "heatmap", zmin = -1, zmax = 1,
          colorscale = list(c(0, "#c23b3b"), c(0.5, "#f0efec"), c(1, "#1c5cab")),
          text = round(m, 2), texttemplate = "%{text}",
          hovertemplate = "%{y} × %{x}: r = %{z}<extra></extra>") |>
    style_plot(height = 400, legend = FALSE, l = 230) |>
    layout(yaxis = list(autorange = "reversed"), xaxis = list(tickangle = -20))
}
