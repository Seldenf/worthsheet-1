# Legacy mortgage calculator page dump — https://worthsheet.com/mortgage-calculator/

Source: WordPress + Elementor page with the "Responsive Mortgage Calculator" plugin (v2.7.0, shortcode, jQuery). Verbatim copy of all copy, labels, defaults and plugin strings. Image URLs relative to `https://worthsheet.com`.

## Page meta

- `<title>`: Mortgage Calculator - WorthSheet
- Yoast meta description: none (not set). `og:description` is an auto-excerpt ("WorthSheet Mortgage Calculator Spreadsheet Template Customizable Spreadsheet Bank-Ready Format Wave Goodbye to Manual Calculations Get the Calculator for FREE Learn More").
- `og:image`: /wp-content/uploads/2024/01/Cell-5.png
- `article:modified_time`: 2024-02-04T21:37:04+00:00
- Nav entry: Header → Products → Mortgage Calculator

## Hero (page copy, in order)

# WorthSheet Mortgage Calculator Spreadsheet Template

- Customizable Spreadsheet
- Bank-Ready Format
- Wave Goodbye to Manual Calculations

Buttons:
- [Get the Calculator for FREE](/download/)
- [Learn More](#features) (the page has no `#features` anchor — dead link on the legacy site)

Images (alt empty): `/wp-content/uploads/2024/01/Cell-5.png` (584×214), `/wp-content/uploads/2024/01/Cell-1-4.png` (540×180), `/wp-content/uploads/2024/01/Cell-2-2.png` (524×148), `/wp-content/uploads/2024/01/Frame-237795.png` (1886×1044) — same hero visuals as the home page.

## Calculator form (`#lidd_mc_form`)

| Label | Input name | Placeholder | **Default value** |
|---|---|---|---|
| Total Amount ($) | `lidd_mc_total_amount` | `$` | 300000 |
| Down Payment ($) | `lidd_mc_down_payment` | `$` | 60000 |
| Interest Rate (%) | `lidd_mc_interest_rate` | `%` | 5 |
| Amortization Period (years) | `lidd_mc_amortization_period` | `years` | 30 |

- Hidden field `lidd_mc_payment_period` = 12 (monthly payments).
- Submit button: **Calculate** (`lidd_mc_submit`).
- Inputs are text fields; non-numeric characters are stripped (`[^\d.]`) before calculating.
- Below the results a small icon (alt `calculator.io`, `/wp-content/plugins/responsive-mortgage-calculator/img/icon_graph.png`, 12 px) opens an external amortization popup (mlcalc.com widget, defaults ma=300000, dp=60000→20 (%), mt=30, ir=5.00, USD `$`, English).

## Plugin settings (`lidd_mc_script_vars`)

- currency `$`, no currency code, number format `6` → `1,234.56` (comma thousands, 2 decimals)
- compounding period: 12 (monthly compounding); payment period: monthly (12)
- minimum total amount: 0; zero-percent interest: NOT allowed; amortization period units: years; summary shown, incl. "total with interest" and "total with down payment"

## Validation / error messages (verbatim)

- Total amount missing or ≤ minimum: "Please enter the total amount. "
- Down payment ≥ total amount: "Please enter a down payment amount or leave blank." (blank = 0 allowed)
- Interest rate not in (0, 100): "Please enter an interest rate."
- Amortization period 0/blank: "Please enter an amortization period."

## Result text (verbatim templates)

Headline result line:

> Monthly Payment: **$X,XXX.XX**

Summary block (shown under the result):

> For a mortgage of **{total_amount}** amortized over **{amortization_years}** years, your **Monthly** payment is:
> Mortgage Payment: **{payment}**
> Total Mortgage with Interest: **{payment × number of payments}**
> Total with Down Payment: **{down payment + total mortgage with interest}** (only shown when down payment > 0)

- `{total_amount}` in the summary = Total Amount − Down Payment (the loan amount, rounded down to whole dollars).
- Fractional years variant: "…amortized over **{years}** years and **{months}** months, your **Monthly** payment is:" ("…and **1** month…" for singular).
- Other payment-period labels the plugin supports (unused here, period is fixed to monthly): Weekly Payment, Bi-Weekly Payment, Monthly Payment, Quarterly Payment, Semi-Annual Payment, Yearly Payment.

## Formula used by the plugin

```
loan      = totalAmount − downPayment
np        = years × 12
rPeriod   = (1 + (rate/100)/12)^(12/12) − 1  = (rate/100)/12      // compounding 12, payments 12
payment   = loan × rPeriod × (1+rPeriod)^np / ((1+rPeriod)^np − 1)
totalWithInterest = payment × np
totalWithDownPayment = downPayment + totalWithInterest
```

Worked default case (computed from the formula above, not copied from the site): loan 240,000, 5 %, 30 years → Monthly Payment $1,288.37; Total Mortgage with Interest $463,813.88; Total with Down Payment $523,813.88.

## Page chrome

Same header/footer as the legacy home page (see `legacy-home.md`). No other body copy exists on the page.
