import { Input } from '@vanilla-bean/components';
import { getCropSuggestions } from '../api/cropSuggestions';

/**
 * Creates a free-form text input with crop suggestions.
 * Loads user's historical crops + defaults asynchronously.
 * @param {HTMLElement} parent - Element to append to
 * @param {string} value - Initial value
 * @param {string} placeholder
 * @returns {Input}
 */
export const makeCropCombobox = (parent, value = '', placeholder = 'e.g. Corn, Winter Wheat, Cover Mix…') => {
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
