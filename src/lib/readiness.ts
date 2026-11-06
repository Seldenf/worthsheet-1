/**
 * Scoring logic for the Mortgage Readiness Assessment (replica of the "Homebuyer Readiness" tab in the
 * WorthSheet template). Pure functions, no DOM access. The bands are WorthSheet's own educational
 * ratings, not lender approval rules.
 *
 * Differences from the spreadsheet formulas:
 * - Credit score bands are contiguous (670–739 Good, 740–799 Very Good); the sheet returned "Undefined"
 *   for 739 and 799.
 * - Unscorable input (empty, NaN, out of range) returns `null` instead of "Undefined".
 * - Boundary values follow the published bands: exactly 85% LTV is Good, exactly 75% LTV is Good,
 *   exactly 60% LTV is Very Good, exactly 28% front-end DTI is Good, exactly 36% back-end DTI is Good.
 */

export type Rating = 'Poor' | 'Fair' | 'Good' | 'Very Good' | 'Excellent';
export type Level = 0 | 1 | 2 | 3 | 4;

/** Ratings in ascending order; the index is the gauge level. */
export const RATINGS: readonly Rating[] = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

/** Gauge level (0–4) of a rating. */
export function ratingLevel(rating: Rating): Level {
	return RATINGS.indexOf(rating) as Level;
}

/** True for Good, Very Good and Excellent. */
export function isGoodOrBetter(rating: Rating | null): boolean {
	return rating !== null && ratingLevel(rating) >= 2;
}

const isNum = (n: number): boolean => typeof n === 'number' && Number.isFinite(n);

/** Credit score 300–850: Poor <580, Fair 580–669, Good 670–739, Very Good 740–799, Excellent 800–850. */
export function rateCreditScore(score: number): Rating | null {
	if (!isNum(score) || score < 300 || score > 850) return null;
	if (score < 580) return 'Poor';
	if (score < 670) return 'Fair';
	if (score < 740) return 'Good';
	if (score < 800) return 'Very Good';
	return 'Excellent';
}

/** Total annual income (all borrowers + other): Poor <$40k, Fair $40–75k, Good $75–150k, Very Good $150–300k, Excellent ≥$300k. */
export function rateIncome(annualIncome: number): Rating | null {
	if (!isNum(annualIncome) || annualIncome <= 0) return null;
	if (annualIncome < 40_000) return 'Poor';
	if (annualIncome < 75_000) return 'Fair';
	if (annualIncome < 150_000) return 'Good';
	if (annualIncome < 300_000) return 'Very Good';
	return 'Excellent';
}

/** Loan-to-value as a decimal ratio of the purchase price. */
export function ltvRatio(price: number, downPayment: number): number {
	if (!isNum(price) || !isNum(downPayment) || price <= 0) return Number.NaN;
	return (price - downPayment) / price;
}

/** LTV (0–1): Poor >92.5%, Fair >85–92.5%, Good 75–85%, Very Good 60–75% (75 is Good), Excellent <60%. */
export function rateLtv(ltv: number): Rating | null {
	if (!isNum(ltv) || ltv < 0 || ltv > 1) return null;
	if (ltv > 0.925) return 'Poor';
	if (ltv > 0.85) return 'Fair';
	if (ltv >= 0.75) return 'Good';
	if (ltv >= 0.6) return 'Very Good';
	return 'Excellent';
}

/** Front-end (housing) DTI as a decimal: Poor >28%, Good 20–28%, Very Good 10–20% (20 is Good), Excellent <10%. No Fair band. */
export function rateFrontDti(ratio: number): Rating | null {
	if (!isNum(ratio) || ratio < 0) return null;
	if (ratio > 0.28) return 'Poor';
	if (ratio > 0.2) return 'Good';
	if (ratio >= 0.1) return 'Very Good';
	return 'Excellent';
}

/** Back-end (total) DTI as a decimal: Poor >36%, Good 30–36%, Very Good 20–30% (30 is Good), Excellent <20%. No Fair band. */
export function rateBackDti(ratio: number): Rating | null {
	if (!isNum(ratio) || ratio < 0) return null;
	if (ratio > 0.36) return 'Poor';
	if (ratio > 0.3) return 'Good';
	if (ratio >= 0.2) return 'Very Good';
	return 'Excellent';
}

/** Personal financial statement: Excellent when one has been created, Poor otherwise (same as the template). */
export function ratePfs(created: boolean): Rating {
	return created ? 'Excellent' : 'Poor';
}

/** Combined rating for the DTI criterion: the weaker of front-end and back-end (null if neither is scorable). */
export function rateDti(front: Rating | null, back: Rating | null): Rating | null {
	if (front === null) return back;
	if (back === null) return front;
	return ratingLevel(front) <= ratingLevel(back) ? front : back;
}

/** Share of gross monthly income used by a monthly payment (NaN when income is not positive). */
export function dtiRatio(monthlyPayments: number, grossMonthlyIncome: number): number {
	if (!isNum(monthlyPayments) || !isNum(grossMonthlyIncome) || grossMonthlyIncome <= 0) return Number.NaN;
	return monthlyPayments / grossMonthlyIncome;
}

/** Average rating of the scored criteria, rounded half up to a gauge level; null when nothing was scored. */
export function overallLevel(ratings: readonly (Rating | null)[]): Level | null {
	const levels = ratings.filter((r): r is Rating => r !== null).map(ratingLevel);
	if (levels.length === 0) return null;
	const mean = levels.reduce<number>((sum, l) => sum + l, 0) / levels.length;
	return Math.min(4, Math.floor(mean + 0.5)) as Level;
}

/** Number of scored criteria rated Good or better. */
export function countGoodOrBetter(ratings: readonly (Rating | null)[]): number {
	return ratings.filter(isGoodOrBetter).length;
}
