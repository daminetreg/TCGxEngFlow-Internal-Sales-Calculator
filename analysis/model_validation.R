library(tidyverse)
library(readxl)

# ============================================================
# 1. CLEAN THE DATA & RENAME COLUMNS (EXACT IMPORT MATCH)
# ============================================================

Company_Database <- Deliverable.3.Database...Company.Database %>%
  rename(
    company = Company,
    industry = Industry.Vertical,
    growth = YoY.Growth....,
    year_founded = Year.Founded,
    company_age = Company.Age,
    funding_stage = Funding.Stage,
    headcount_low = Headcount.Low,
    headcount_high = Headcount.High,
    avg_salary_k = Average.Salary
  )

# ============================================================
# 2. CONVERT VARIABLES & PREPARE SALARY DATA
# ============================================================

Company_Database <- Company_Database %>%
  mutate(
    growth = as.numeric(growth),
    headcount_low = as.numeric(headcount_low),
    headcount_high = as.numeric(headcount_high),
    avg_salary_k = as.numeric(avg_salary_k),
    avg_salary_usd = ifelse(!is.na(avg_salary_k), avg_salary_k * 1000, 180000)
  )

# ============================================================
# 3. GROUP FUNDING STAGES INTO 3 TIERS
# ============================================================

Company_Database <- Company_Database %>%
  mutate(
    funding_tier = case_when(
      funding_stage %in% c("Series A", "Series B") ~ "Series A & B",
      funding_stage %in% c("Series C", "Series D", "Series D (going public)") ~ "Series C & D",
      funding_stage %in% c("Series F", "Series H", "Late Stage", "Late stage", "Public") ~ "Late Stage & Public",
      TRUE ~ NA_character_
    )
  )

Company_Database$funding_tier <- factor(
  Company_Database$funding_tier,
  levels = c("Series A & B", "Series C & D", "Late Stage & Public")
)

# ============================================================
# 4. CREATE CLEAN ANALYSIS DATASET (FILTERING NA & OUTLIERS)
# ============================================================

analysis_df <- Company_Database %>%
  filter(!is.na(growth), !is.na(funding_tier))

model_1_full <- lm(growth ~ funding_tier, data = analysis_df)

analysis_df <- analysis_df %>%
  mutate(studentized_residual = rstudent(model_1_full))

analysis_df_clean <- analysis_df %>%
  filter(abs(studentized_residual) <= 3)

# ============================================================
# 5. MODEL 1: OLS REGRESSION (X1 = funding_tier)
# ============================================================

model_1 <- lm(
  growth ~ funding_tier,
  data = analysis_df_clean
)

summary(model_1)

# ============================================================
# 6. FUNCTION: 4-YEAR RANGE PROJECTION FUNCTION (LOW & HIGH)
# ============================================================

calculate_prospect_4yr_impact <- function(model, 
                                          company_name, 
                                          funding_tier, 
                                          initial_headcount_low,
                                          initial_headcount_high,
                                          avg_salary = 180000,
                                          daily_prs_per_dev = 3,
                                          ai_pr_multiplier = 1.25) {
  
  prospect_input <- data.frame(
    funding_tier = factor(funding_tier, levels = levels(analysis_df_clean$funding_tier))
  )
  
  predicted_growth_pct <- predict(model, newdata = prospect_input)
  growth_rate <- predicted_growth_pct / 100
  hourly_wage <- avg_salary / 2000
  
  compute_metrics <- function(hc) {
    N <- round(hc)
    V <- (N * (N - 1)) / 2
    base_build_mins <- 5 + (V / 1000) * 1.5
    context_drag_mins <- ifelse(base_build_mins > 15, 15, 5)
    total_wait_mins <- base_build_mins + context_drag_mins
    daily_wait_hrs <- (daily_prs_per_dev * ai_pr_multiplier * total_wait_mins) / 60
    annual_lost_hrs <- N * daily_wait_hrs * 252
    annual_loss_usd <- annual_lost_hrs * hourly_wage
    
    return(list(
      N = N, 
      V = round(V), 
      daily_hrs = round(daily_wait_hrs, 2), 
      annual_hrs = round(annual_lost_hrs), 
      loss_usd = round(annual_loss_usd)
    ))
  }
  
  projection_list <- list()
  current_hc_low <- initial_headcount_low
  current_hc_high <- initial_headcount_high
  
  for (yr in 1:4) {
    if (yr > 1) {
      current_hc_low <- current_hc_low * (1 + growth_rate)
      current_hc_high <- current_hc_high * (1 + growth_rate)
    }
    
    m_low <- compute_metrics(current_hc_low)
    m_high <- compute_metrics(current_hc_high)
    
    projection_list[[yr]] <- data.frame(
      Company = company_name,
      Year = paste("Year", yr),
      Predicted_YoY_Growth_Pct = round(predicted_growth_pct, 2),
      Headcount_Low = m_low$N,
      Headcount_High = m_high$N,
      Interaction_Vectors_Low = m_low$V,
      Interaction_Vectors_High = m_high$V,
      Daily_Wait_Hours_Low = m_low$daily_hrs,
      Daily_Wait_Hours_High = m_high$daily_hrs,
      Annual_Team_Lost_Hours_Low = m_low$annual_hrs,
      Annual_Team_Lost_Hours_High = m_high$annual_hrs,
      Annual_Productivity_Loss_USD_Low = m_low$loss_usd,
      Annual_Productivity_Loss_USD_High = m_high$loss_usd
    )
  }
  
  return(do.call(rbind, projection_list))
}

# ============================================================
# 7. RUN 4-YEAR PROJECTIONS FOR SAMPLE PROSPECTS
# ============================================================

retool_projection <- calculate_prospect_4yr_impact(
  model = model_1,
  company_name = "Retool",
  funding_tier = "Series C & D",
  initial_headcount_low = 201,
  initial_headcount_high = 500,
  avg_salary = 180000
)

glean_projection <- calculate_prospect_4yr_impact(
  model = model_1,
  company_name = "Glean",
  funding_tier = "Series C & D",
  initial_headcount_low = 501,
  initial_headcount_high = 1000,
  avg_salary = 190000
)

sample_4yr_table <- rbind(retool_projection, glean_projection)
print(sample_4yr_table)

# ============================================================
# 8. BATCH PROJECTION ACROSS ENTIRE COMPANY DATABASE
# ============================================================

all_company_projections <- list()

for (i in 1:nrow(Company_Database)) {
  row <- Company_Database[i, ]
  
  if (is.na(row$funding_tier) | is.na(row$headcount_low) | is.na(row$headcount_high)) next
  
  proj <- tryCatch({
    calculate_prospect_4yr_impact(
      model = model_1,
      company_name = row$company,
      funding_tier = row$funding_tier,
      initial_headcount_low = row$headcount_low,
      initial_headcount_high = row$headcount_high,
      avg_salary = row$avg_salary_usd
    )
  }, error = function(e) NULL)
  
  if (!is.null(proj)) {
    all_company_projections[[length(all_company_projections) + 1]] <- proj
  }
}

full_database_4yr_table <- do.call(rbind, all_company_projections)

# ============================================================
# 9. EXPORT MODEL 1 RESULTS & RANGE TABLES TO CSV
# ============================================================

write.csv(summary(model_1)$coefficients, "model_1_coefficients.csv")
write.csv(sample_4yr_table, "sample_prospects_4year_range_projection.csv", row.names = FALSE)
write.csv(full_database_4yr_table, "full_database_4year_range_projection.csv", row.names = FALSE)