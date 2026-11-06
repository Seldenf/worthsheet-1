/** Home affordability model (28/36 rule with property tax, insurance and HOA). DOM-free. */
import { formatPercent, formatUSD, monthlyPayment, principalForPayment } from '../../lib/finance';
import { readFields, type NumRule } from './fields';

/** Illustrative example inputs, not market data. */
export const AFFORD_DEFAULTS = {
	income: 96000,
	debts: 500,
	down: 50000,
	rate: 6.5,
	years: 30,
	taxRate: 1.2,
	insurance: 1800,
	hoa: 0,
} as const;

export type AffordKey = 'income' | 'debts' | 'down' | 'rate' | 'years' | 'taxRate' | 'insurance' | 'hoa';
export const AFFORD_KEYS: readonly AffordKey[] = ['income', 'debts', 'down', 'rate', 'years', 'taxRate', 'insurance', 'hoa'];

export const FRONT_LIMIT = 0.28;
export const BACK_LIMIT = 0.36;

const RULES: Record<AffordKey, NumRule> = {
	income: { name: 'your annual gross income', required: true, min: 0, minExclusive: true, unit: '$' },
	debts: { name: 'your monthly debt payments', min: 0, unit: '$' },
	down: { name: 'a down payment', min: 0, unit: '$' },
	rate: { name: 'an interest rate', required: true, min: 0, max: 100, unit: '%' },
	years: { name: 'a loan term', required: true, min: 1, max: 50, unit: 'years' },
	taxRate: { name: 'a property tax rate', min: 0, max: 10, unit: '%' },
	insurance: { name: 'annual homeowners insurance', min: 0, unit: '$' },
	hoa: { name: 'monthly HOA dues', min: 0, unit: '$' },
};

export interface AffordResult {
	monthlyIncome: number;
	/** Which cap set the budget. */
	binding: 'front' | 'back';
	frontCap: number;
	backCap: number;
	/** Maximum total monthly housing payment = min(front cap, back cap). */
	budget: number;
	price: number;
	loan: number;
	down: number;
	downPercent: number;
	principalInterest: number;
	propertyTax: number;
	insurance: number;
	hoa: number;
	/** P&I + tax + insurance + HOA. */
	housingTotal: number;
	frontEnd: number;
	backEnd: number;
	pmiLikely: boolean;
}

export type AffordOutcome =
	| { ok: true; result: AffordResult }
	/** `noRoom` is set when inputs are valid but the 28/36 budget leaves nothing for a mortgage. */
	| { ok: false; errors: Partial<Record<AffordKey, string>>; noRoom?: string };

/**
 * Max price solved algebraically. With c = principalForPayment(1, rate, years) (loan per $1 of monthly P&I),
 * tm = tax rate / 12, F = insurance/12 + HOA and the P&I budget = budget − F − tm × (loan + down):
 *   loan = c × (budget − F − tm × down) ÷ (1 + c × tm);  price = loan + down.
 */
export function evaluateAffordability(raw: Record<AffordKey, string>): AffordOutcome {
	const { values: v, errors } = readFields(raw, RULES);
	if (Object.keys(errors).length > 0) return { ok: false, errors };

	const monthlyIncome = v.income / 12;
	const frontCap = FRONT_LIMIT * monthlyIncome;
	const backCap = BACK_LIMIT * monthlyIncome - v.debts;
	const binding = frontCap <= backCap ? 'front' : 'back';
	const budget = Math.min(frontCap, backCap);
	const fixed = v.insurance / 12 + v.hoa;
	const tm = v.taxRate / 100 / 12;
	const annualRate = v.rate / 100;

	const loanPerDollar = principalForPayment(1, annualRate, v.years);
	const piBudgetAtDown = budget - fixed - tm * v.down;
	const loan = (loanPerDollar * piBudgetAtDown) / (1 + loanPerDollar * tm);
	if (budget <= 0 || !(loan > 0)) {
		const reason =
			budget <= 0
				? 'Your monthly debts already use the whole 36% back-end budget, so the 28/36 rule leaves no room for a housing payment.'
				: 'After homeowners insurance, HOA dues and property tax on your down payment, the 28/36 budget leaves no room for a mortgage payment.';
		return { ok: false, errors: {}, noRoom: reason };
	}

	const price = loan + v.down;
	const principalInterest = monthlyPayment(loan, annualRate, v.years);
	const propertyTax = tm * price;
	const insurance = v.insurance / 12;
	const housingTotal = principalInterest + propertyTax + insurance + v.hoa;
	return {
		ok: true,
		result: {
			monthlyIncome,
			binding,
			frontCap,
			backCap,
			budget,
			price,
			loan,
			down: v.down,
			downPercent: v.down / price,
			principalInterest,
			propertyTax,
			insurance,
			hoa: v.hoa,
			housingTotal,
			frontEnd: housingTotal / monthlyIncome,
			backEnd: (housingTotal + v.debts) / monthlyIncome,
			pmiLikely: v.down / price < 0.2,
		},
	};
}

const defaultRaw = Object.fromEntries(AFFORD_KEYS.map((k) => [k, String(AFFORD_DEFAULTS[k])])) as Record<AffordKey, string>;
const defaultOutcome = evaluateAffordability(defaultRaw);
if (!defaultOutcome.ok) throw new Error('Affordability defaults must be valid');
export const defaultAfford: AffordResult = defaultOutcome.result;

/** Text for every `data-out` element on the affordability page (prerendered defaults and live updates). */
export function affordOutputs(r: AffordResult): Record<string, string> {
	const rule =
		r.binding === 'front'
			? `Your budget is set by the 28% front-end limit (28% of ${formatUSD(r.monthlyIncome)} = ${formatUSD(r.frontCap, true)}).`
			: `Your budget is set by the 36% back-end limit (36% of ${formatUSD(r.monthlyIncome)} minus your monthly debts = ${formatUSD(r.backCap, true)}).`;
	return {
		price: formatUSD(r.price),
		loan: formatUSD(r.loan),
		down: formatUSD(r.down),
		downPct: `${(r.downPercent * 100).toFixed(1)}% of the price`,
		budget: formatUSD(r.budget, true),
		rule,
		pi: formatUSD(r.principalInterest, true),
		tax: formatUSD(r.propertyTax, true),
		ins: formatUSD(r.insurance, true),
		hoa: formatUSD(r.hoa, true),
		total: formatUSD(r.housingTotal, true),
		front: formatPercent(r.frontEnd),
		back: formatPercent(r.backEnd),
	};
}
