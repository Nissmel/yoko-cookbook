UPDATE public.meal_plans
SET plan_date = plan_date + INTERVAL '3 days'
WHERE plan_date BETWEEN '2026-04-20' AND '2026-04-23';