/** Debt-to-income calculator model. DOM-free. */
import { formatPercent, formatUSD } from '../../lib/finance';
import { readFields, type NumRule } from './fields';

/**
 * Prefilled with the CFPB's own example ($1,500 housing + $100 auto + $400 other = $2,000 on $6,000 gross
 * monthly income = 33%).
 */
export const DTI_DEFAULTS = {
	income: 6000,
	housing: 1500,
	car: 100,
	student: 0,
	card: 0,
	personal: 0,
	other: 400,
} as const;

export type DtiKey = 'income' | 'housing' | 'car' | 'student' | 'card' | 'personal' | 'other';
export const DTI_KEYS: readonly DtiKey[] = ['income', 'housing', 'car', 'student', 'card', 'personal', 'other'];
export const DTI_DEBT_KEYS: readonly DtiKey[] = ['car', 'student', 'card', 'personal', 'other'];

export const FRONT_BENCHMARK = 0.28;
export const BACK_BENCHMARK = 0.36;

const money = (name: string): NumRule => ({ name, min: 0, unit: '$' });
const RULES: Record<DtiKey, NumRule> = {
	income: { name: 'your gross income', required: true, min: 0, minExclusive: true, unit: '$' },
	housing: money('a proposed housing payment'),
	car: money('your car payment'),
	student: money('your student loan payment'),
	card: money('your credit card minimum payments'),
	personal: money('your personal loan payment'),
	other: money('other monthly debt payments'),
};

export type DtiStatus = 'good' | 'caution' | 'high';

export interface DtiRating {
	status: DtiStatus;
	/** Short label shown as text next to the icon. */
	label: string;
	/** One-sentence explanation. */
	detail: string;
}

export interface DtiResult {
	monthlyIncome: number;
	housing: number;
	debts: number;
	frontEnd: number | null;
	backEnd: number;
	frontLimit: number;
	backLimit: number;
	frontRating: DtiRating | null;
	backRating: DtiRating;
}

export function rateFrontEnd(ratio: number): DtiRating {
	if (ratio <= FRONT_BENCHMARK) {
		return { status: 'good', label: 'At or under 28%', detail: 'Within the 28% front-end rule of thumb.' };
	}
	return {
		status: 'caution',
		label: 'Above 28%',
		detail: 'Above the 28% rule of thumb. It is a benchmark, not a lender requirement, so a lender may still look at the full picture.',
	};
}

export function rateBackEnd(ratio: number): DtiRating {
	if (ratio <= BACK_BENCHMARK) {
		return { status: 'good', label: 'At or under 36%', detail: 'Within the 36% back-end rule of thumb and Fannie Mae\u2019s 36% manual-underwriting limit.' };
	}
	if (ratio <= 0.45) {
		return {
			status: 'caution',
			label: 'Above 36%, up to 45%',
			detail: 'Above 36%. Fannie Mae allows up to 45% for manually underwritten loans only when its credit score and reserve requirements are met.',
		};
	}
	if (ratio <= 0.5) {
		return {
			status: 'high',
			label: 'Above 45%, up to 50%',
			detail: 'Above 45%. Fannie Mae\u2019s limit for loans approved through Desktop Underwriter is 50%; manual underwriting stops at 45%.',
		};
	}
	return {
		status: 'high',
		label: 'Above 50%',
		detail: 'Above 50%, which is higher than Fannie Mae\u2019s maximum. Other programs and lenders set their own limits.',
	};
}

export type DtiOutcome =
	| { ok: true; result: DtiResult }
	| { ok: false; errors: Partial<Record<DtiKey, string>> };

/** `period` states whether the entered income is monthly or annual. */
export function evaluateDti(raw: Record<DtiKey, string>, period: 'monthly' | 'annual'): DtiOutcome {
	const { values, errors } = readFields(raw, RULES);
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	const monthlyIncome = period === 'annual' ? values.income / 12 : values.income;
	const debts = DTI_DEBT_KEYS.reduce((sum, key) => sum + values[key], 0);
	const housing = values.housing;
	const frontEnd = housing > 0 ? housing / monthlyIncome : null;
	const backEnd = (housing + debts) / monthlyIncome;
	return {
		ok: true,
		result: {
			monthlyIncome,
			housing,
			debts,
			frontEnd,
			backEnd,
			frontLimit: FRONT_BENCHMARK * monthlyIncome,
			backLimit: BACK_BENCHMARK * monthlyIncome,
			frontRating: frontEnd === null ? null : rateFrontEnd(frontEnd),
			backRating: rateBackEnd(backEnd),
		},
	};
}

const defaultRaw = Object.fromEntries(DTI_KEYS.map((k) => [k, String(DTI_DEFAULTS[k])])) as Record<DtiKey, string>;
const defaultOutcome = evaluateDti(defaultRaw, 'monthly');
if (!defaultOutcome.ok) throw new Error('DTI defaults must be valid');
export const defaultDti: DtiResult = defaultOutcome.result;

export type BadgeStatus = DtiStatus | 'none';

/** Text glyph shown next to every status label so the status never relies on color alone. */
export const STATUS_ICON: Record<BadgeStatus, string> = { good: '\u2713', caution: '!', high: '\u2715', none: '\u2013' };

function difference(limit: number, yours: number): string {
	const gap = limit - yours;
	return gap >= 0 ? `${formatUSD(gap)} under` : `${formatUSD(-gap)} over`;
}

/** Text for every `data-out` element on the DTI page plus the status of each ratio badge. */
export function dtiOutputs(r: DtiResult): { text: Record<string, string>; status: { front: BadgeStatus; back: BadgeStatus } } {
	const hasHousing = r.frontEnd !== null;
	return {
		text: {
			front: r.frontEnd === null ? '\u2014' : formatPercent(r.frontEnd),
			frontLabel: r.frontRating ? r.frontRating.label : 'Not calculated',
			frontDetail: r.frontRating ? r.frontRating.detail : 'Enter a proposed housing payment to see front-end DTI.',
			back: formatPercent(r.backEnd),
			backLabel: r.backRating.label,
			backDetail: r.backRating.detail,
			income: formatUSD(r.monthlyIncome, true),
			housing: formatUSD(r.housing, true),
			debts: formatUSD(r.debts, true),
			payments: formatUSD(r.housing + r.debts, true),
			frontLimitAmt: formatUSD(r.frontLimit, true),
			frontYours: hasHousing ? formatUSD(r.housing, true) : '\u2014',
			frontDiff: hasHousing ? difference(r.frontLimit, r.housing) : '\u2014',
			backLimitAmt: formatUSD(r.backLimit, true),
			backYours: formatUSD(r.housing + r.debts, true),
			backDiff: difference(r.backLimit, r.housing + r.debts),
		},
		status: { front: r.frontRating ? r.frontRating.status : 'none', back: r.backRating.status },
	};
}
