# 💰 Family Finance: Expense Tracker

A private, browser-based expense tracker for the whole family. There's no sign-up and no server; your data stays in your browser.

## Features

| Tab | What you get |
| --- | --- |
| 📊 **Dashboard** | Family income, spending, EMIs and net savings for any month. Also: a 6-month income vs. outflow chart, spending by category, income by member, upcoming bills and EMIs for the next 45 days, credit-card and loan snapshots, goals, the next trip, and **automatic insights** (savings rate, EMI-to-income ratio, month-over-month change, budgets you've gone over, high card utilization, money family owes you, EMIs that are about to end). |
| 👨‍👩‍👧 **Family Income** | A tab for every family member, plus an "All family" view. Income can be one-time or recurring every month (salary, rent, pension). Shows each member's 12-month chart, breakdown by source and share of the family's income. |
| 🧾 **Expenses** | Add, search and filter expenses by month and category. Tag each one with the payment method (UPI, cash, card, bank), the family member it was for, and whether it repeats every month. |
| 💳 **Credit Cards** | Cards shown visually with limit, utilization, available credit, next statement date and due date. **Unbilled spends** per card, with a button to generate the statement and another to mark the bill as paid. |
| 🏦 **EMIs** | EMIs on a card or as a bank loan, with amount, interest rate (0% for no-cost EMIs), **duration in months** and start date. A live calculator shows the monthly EMI, total interest and end date. Each EMI shows instalments paid, months left and outstanding principal. |
| 🤝 **Shared EMIs** | Split any EMI by percentage with family members. A month-by-month grid shows who has paid you back, how much is still pending, and what is still to come. |
| ✈️ **Trip Planner** | Set a budget, dates and travellers. Track planned vs. actual cost per item, see a day countdown and the amount to save each month, and keep a packing/booking checklist. **Split & settle up** shows who owes whom. |
| 🎯 **Budgets & Goals** | Set a monthly budget per category, with a pace marker that warns you early if you're spending too fast. Savings goals track progress and how much to save each month. |
| ⚙️ **Settings** | Currency (₹, $, €, £ and more), light/dark theme, JSON backup and restore, and CSV export. |

The app opens with sample data so you can explore it. Click **Start fresh** to clear it and begin with your own numbers.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Deploy

`.github/workflows/deploy.yml` publishes the app to GitHub Pages on every push to `main`. To use it, enable Pages under *Settings → Pages → Source: GitHub Actions*.

Built with React, TypeScript, Vite and Recharts.
