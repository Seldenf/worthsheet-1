/**
 * Browser-only helpers shared by the calculator page scripts. Import from a page `<script>`:
 *   import { bindCalculator, setOut, showError, createUseTracker } from '../components/calculators/calc';
 *
 * Conventions (match the components in this folder):
 * - Inputs are plain elements with an `id`; `MoneyInput` renders a `#<id>-error` element for messages.
 * - Result values are any element with `data-out="<key>"` (`ResultCard` renders one per card).
 * - The results region has `data-results` (shown when inputs are valid) and `data-empty` (shown otherwise),
 *   both inside `CalcLayout`'s `aria-live="polite"` container.
 */
import { track } from '../../lib/analytics';

export function inputValue(id: string): string {
	const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
	return el ? el.value : '';
}

/** Collects the raw string values of the given input ids into an object keyed by id. */
export function readInputs<K extends string>(ids: readonly K[]): Record<K, string> {
	const out = {} as Record<K, string>;
	for (const id of ids) out[id] = inputValue(id);
	return out;
}

/** Shows (or clears, when `message` is falsy) the error for an input and sets `aria-invalid`. */
export function showError(id: string, message?: string): void {
	const input = document.getElementById(id);
	const err = document.getElementById(`${id}-error`);
	if (input) {
		if (message) input.setAttribute('aria-invalid', 'true');
		else input.removeAttribute('aria-invalid');
	}
	if (err) {
		err.textContent = message ?? '';
		err.hidden = !message;
	}
}

/** Applies an error map to all given ids (clearing ids without an entry). */
export function showErrors(ids: readonly string[], errors: Partial<Record<string, string>>): void {
	for (const id of ids) showError(id, errors[id]);
}

/** Sets the text of every `[data-out="key"]` element. */
export function setOut(key: string, text: string): void {
	document.querySelectorAll<HTMLElement>(`[data-out="${key}"]`).forEach((el) => {
		el.textContent = text;
	});
}

export function setOutAll(values: Record<string, string>): void {
	for (const [key, text] of Object.entries(values)) setOut(key, text);
}

/** Toggles every `[data-results]` block against the `[data-empty]` message (optionally replacing its text). */
export function showResults(valid: boolean, emptyMessage?: string): void {
	document.querySelectorAll<HTMLElement>('[data-results]').forEach((el) => {
		el.hidden = !valid;
	});
	const empty = document.querySelector<HTMLElement>('[data-empty]');
	if (empty) {
		empty.hidden = valid;
		if (!valid && emptyMessage) empty.textContent = emptyMessage;
	}
}

/**
 * Wires a calculator form: `update(interacted)` runs once on load (`false`, re-syncing browser-restored values)
 * and on every input/change/submit (`true`). Submitting never reloads the page.
 */
export function bindCalculator(formId: string, update: (interacted: boolean) => void): void {
	const form = document.getElementById(formId) as HTMLFormElement | null;
	if (!form) return;
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		update(true);
	});
	form.addEventListener('input', () => update(true));
	form.addEventListener('change', () => update(true));
	update(false);
}

/** Returns a function that sends `calculator_use` once per page view (the first time it is called). */
export function createUseTracker(calculator: string): () => void {
	let sent = false;
	return () => {
		if (sent) return;
		sent = true;
		track('calculator_use', { calculator });
	};
}
