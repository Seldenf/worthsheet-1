/**
 * DOM-free numeric field parsing/validation shared by the calculator models (runs at build time for
 * the prerendered default results and in the browser for live results).
 */
import { formatUSD, parseAmount } from '../../lib/finance';

export type Unit = '$' | '%' | 'years' | '';

export interface NumRule {
	/** Phrase used inside messages, e.g. "the total amount" → "Enter the total amount." */
	name: string;
	/** Empty input is an error (default: empty is treated as `fallback`, which defaults to 0). */
	required?: boolean;
	/** Value used for empty optional fields (default 0). */
	fallback?: number;
	min?: number;
	/** When true the value must be strictly greater than `min`. */
	minExclusive?: boolean;
	max?: number;
	unit?: Unit;
}

export interface FieldResult {
	value: number;
	error?: string;
}

function fmt(n: number, unit: Unit = ''): string {
	if (unit === '$') return formatUSD(n);
	if (unit === '%') return `${n}%`;
	if (unit === 'years') return `${n} ${n === 1 ? 'year' : 'years'}`;
	return String(n);
}

function sentence(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Parses one raw input string against a rule. `value` is NaN when `error` is set. */
export function readField(raw: string, rule: NumRule): FieldResult {
	const parsed = parseAmount(raw);
	if (Number.isNaN(parsed)) {
		if (raw.trim() === '') {
			if (rule.required) return { value: Number.NaN, error: `Enter ${rule.name}.` };
			return { value: rule.fallback ?? 0 };
		}
		return { value: Number.NaN, error: `Use numbers only for ${rule.name}, for example 1200.` };
	}
	if (!Number.isFinite(parsed)) return { value: Number.NaN, error: `Enter a valid number for ${rule.name}.` };
	if (rule.min !== undefined) {
		const tooLow = rule.minExclusive ? parsed <= rule.min : parsed < rule.min;
		if (tooLow) {
			const bound = rule.minExclusive ? 'greater than' : 'at least';
			return { value: Number.NaN, error: `${sentence(rule.name)} must be ${bound} ${fmt(rule.min, rule.unit)}.` };
		}
	}
	if (rule.max !== undefined && parsed > rule.max) {
		return { value: Number.NaN, error: `${sentence(rule.name)} must be ${fmt(rule.max, rule.unit)} or less.` };
	}
	return { value: parsed };
}

/** Reads every field of a form model; returns the first-error-per-field map and the parsed values. */
export function readFields<K extends string>(
	raw: Record<K, string>,
	rules: Record<K, NumRule>,
): { values: Record<K, number>; errors: Partial<Record<K, string>> } {
	const values = {} as Record<K, number>;
	const errors: Partial<Record<K, string>> = {};
	for (const key of Object.keys(rules) as K[]) {
		const res = readField(raw[key], rules[key]);
		values[key] = res.value;
		if (res.error) errors[key] = res.error;
	}
	return { values, errors };
}
