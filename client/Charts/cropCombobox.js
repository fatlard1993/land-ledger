import { Input } from '@vanilla-bean/components';
import { FormLabel } from '../Layout';
import { getCropSuggestions } from '../api/cropSuggestions';

/**
 * A labelled free-form text input with crop suggestions: the user's historical crops and the defaults, loaded once the
 * field is showing.
 * @param {HTMLElement|object} parent - Where the label and field go
 * @param {object} options - Field options
 * @param {string} options.label - The field's label
 * @param {string} [options.value] - Initial value
 * @param {string} [options.placeholder] - An example crop
 * @returns {Input} The field
 */
export const makeCropCombobox = (
	parent,
	{ label, value = '', placeholder = 'e.g. Corn, Winter Wheat, Cover Mix…' },
) => {
	new FormLabel({ appendTo: parent, textContent: label });
	const input = new Input({ type: 'text', placeholder, value, appendTo: parent });

	// Populate asynchronously — dialog opens immediately, suggestions appear within ~100ms
	getCropSuggestions()
		.then(crops => {
			input.options.suggestions = crops;
		})
		.catch(() => {
			/* suggestions unavailable — static list in use */
		});

	return input;
};
