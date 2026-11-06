/** Shared, framework-free finance math used by calculators and the readiness assessment (client + build). */

/** Monthly payment for a fully amortizing loan. `annualRate` is a decimal (0.065 = 6.5%). Matches Sheets `-PMT(rate/12, years*12, principal)`. */
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
	const n = Math.round(years * 12);
	if (principal <= 0 || n <= 0) return 0;
	const r = annualRate / 12;
	if (r === 0) return principal / n;
	return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Largest principal whose monthly payment equals `payment` (inverse of `monthlyPayment`). */
export function principalForPayment(payment: number, annualRate: number, years: number): number {
	const n = Math.round(years * 12);
	if (payment <= 0 || n <= 0) return 0;
	const r = annualRate / 12;
	if (r === 0) return payment * n;
	return (payment * (1 - Math.pow(1 + r, -n))) / r;
}

export interface AmortizationYear {
	year: number;
	principalPaid: number;
	interestPaid: number;
	endingBalance: number;
}

/** Year-by-year amortization summary. The final payment absorbs rounding so the balance ends at exactly 0. */
export function amortizationByYear(principal: number, annualRate: number, years: number): AmortizationYear[] {
	const n = Math.round(years * 12);
	const pay = monthlyPayment(principal, annualRate, years);
	const r = annualRate / 12;
	const rows: AmortizationYear[] = [];
	let balance = principal;
	for (let y = 1; y <= Math.ceil(n / 12); y++) {
		let principalPaid = 0;
		let interestPaid = 0;
		for (let m = 0; m < 12 && (y - 1) * 12 + m < n; m++) {
			const interest = balance * r;
			const toPrincipal = Math.min(pay - interest, balance);
			interestPaid += interest;
			principalPaid += toPrincipal;
			balance -= toPrincipal;
		}
		rows.push({ year: y, principalPaid, interestPaid, endingBalance: Math.max(0, balance) });
	}
	return rows;
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `$1,234` (whole dollars) or `$1,234.56` with `cents`. */
export function formatUSD(value: number, cents = false): string {
	return (cents ? usd2 : usd0).format(Number.isFinite(value) ? value : 0);
}

/** `28.4%` from a decimal ratio. */
export function formatPercent(ratio: number, digits = 1): string {
	return `${(Number.isFinite(ratio) ? ratio * 100 : 0).toFixed(digits)}%`;
}

/** Parses user input like "$1,200.50" or "6.5%" to a number; returns NaN when empty/invalid. */
export function parseAmount(raw: string): number {
	const cleaned = raw.replace(/[$,%\s]/g, '');
	return cleaned === '' ? Number.NaN : Number(cleaned);
}
