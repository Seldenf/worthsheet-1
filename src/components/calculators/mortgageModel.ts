/** Mortgage calculator model (fixed-rate, monthly payments, principal & interest only). DOM-free. */
import { amortizationByYear, formatUSD, monthlyPayment, type AmortizationYear } from '../../lib/finance';
import { readFields, type NumRule } from './fields';

/** Legacy defaults from the previous WorthSheet mortgage calculator. */
export const MORTGAGE_DEFAULTS = { price: 300000, down: 60000, rate: 5, years: 30 } as const;

export type MortgageKey = 'price' | 'down' | 'rate' | 'years';
export const MORTGAGE_KEYS: readonly MortgageKey[] = ['price', 'down', 'rate', 'years'];

const RULES: Record<MortgageKey, NumRule> = {
	price: { name: 'the total amount', required: true, min: 0, minExclusive: true, unit: '$' },
	down: { name: 'a down payment', min: 0, unit: '$' },
	rate: { name: 'an interest rate', required: true, min: 0, max: 100, unit: '%' },
	years: { name: 'an amortization period', required: true, min: 1, max: 50, unit: 'years' },
};

export interface MortgageResult {
	price: number;
	down: number;
	loan: number;
	/** Monthly principal & interest. */
	payment: number;
	payments: number;
	/** Payment × number of payments. */
	totalPayments: number;
	totalInterest: number;
	/** Down payment + all payments (legacy "Total with Down Payment"). */
	totalCost: number;
	principalShare: number;
	interestShare: number;
	payoffYears: number;
	rows: AmortizationYear[];
}

export function computeMortgage(price: number, down: number, ratePercent: number, years: number): MortgageResult {
	const loan = price - down;
	const annualRate = ratePercent / 100;
	const payment = monthlyPayment(loan, annualRate, years);
	const payments = Math.round(years * 12);
	const totalPayments = payment * payments;
	const rows = amortizationByYear(loan, annualRate, years);
	return {
		price,
		down,
		loan,
		payment,
		payments,
		totalPayments,
		totalInterest: totalPayments - loan,
		totalCost: down + totalPayments,
		principalShare: loan / totalPayments,
		interestShare: (totalPayments - loan) / totalPayments,
		payoffYears: rows.length,
		rows,
	};
}

export type MortgageOutcome =
	| { ok: true; result: MortgageResult }
	| { ok: false; errors: Partial<Record<MortgageKey, string>> };

export function evaluateMortgage(raw: Record<MortgageKey, string>): MortgageOutcome {
	const { values, errors } = readFields(raw, RULES);
	if (!errors.price && !errors.down && values.down >= values.price) {
		errors.down = 'The down payment must be less than the total amount.';
	}
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return { ok: true, result: computeMortgage(values.price, values.down, values.rate, values.years) };
}

export const defaultMortgage: MortgageResult = computeMortgage(
	MORTGAGE_DEFAULTS.price,
	MORTGAGE_DEFAULTS.down,
	MORTGAGE_DEFAULTS.rate,
	MORTGAGE_DEFAULTS.years,
);

/** Text for every `data-out` element on the mortgage page (used for the prerendered defaults and live updates). */
export function mortgageOutputs(r: MortgageResult): Record<string, string> {
	const interestPct = Math.round(r.interestShare * 100);
	const principalPct = 100 - interestPct;
	return {
		payment: formatUSD(r.payment, true),
		loan: formatUSD(r.loan),
		interest: formatUSD(r.totalInterest),
		total: formatUSD(r.totalCost),
		payoff: `${r.payoffYears} ${r.payoffYears === 1 ? 'year' : 'years'}`,
		principalLegend: `Principal ${formatUSD(r.loan)} (${principalPct}%)`,
		interestLegend: `Interest ${formatUSD(r.totalInterest)} (${interestPct}%)`,
		barLabel: `Of the ${formatUSD(r.totalPayments)} you pay over the loan, ${principalPct}% is principal and ${interestPct}% is interest.`,
	};
}

/** Percent widths for the principal/interest stacked bar. */
export function mortgageBar(r: MortgageResult): { principal: number; interest: number } {
	const interest = Math.round(r.interestShare * 100);
	return { principal: 100 - interest, interest };
}

/** `<tr>` rows for the yearly schedule body. Numbers only, so safe as raw HTML. */
export function scheduleBodyHtml(rows: AmortizationYear[]): string {
	return rows
		.map(
			(row) =>
				`<tr><th scope="row">${row.year}</th><td class="num">${formatUSD(row.principalPaid)}</td><td class="num">${formatUSD(row.interestPaid)}</td><td class="num">${formatUSD(row.endingBalance)}</td></tr>`,
		)
		.join('');
}

export function scheduleFootHtml(rows: AmortizationYear[]): string {
	const principal = rows.reduce((sum, row) => sum + row.principalPaid, 0);
	const interest = rows.reduce((sum, row) => sum + row.interestPaid, 0);
	return `<tr><th scope="row">Total</th><td class="num">${formatUSD(principal)}</td><td class="num">${formatUSD(interest)}</td><td class="num">—</td></tr>`;
}
