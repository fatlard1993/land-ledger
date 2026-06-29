import { FormInput } from '../Layout';
import { getCropSuggestions } from '../api/cropSuggestions';

let _datalistId = 0;

/**
 * Creates a free-form text input with crop suggestions datalist.
 * Loads user's historical crops + defaults asynchronously.
 * @param {HTMLElement} parent - Element to append to
 * @param {string} value - Initial value
 * @param {string} placeholder
 * @returns {FormInput}
 */
export const makeCropCombobox = (parent, value = '', placeholder = 'e.g. Corn, Winter Wheat, Cover Mix…') => {
	const id = `crop-datalist-${++_datalistId}`;

	const datalist = document.createElement('datalist');

	datalist.id = id;
	parent.append(datalist);

	const input = new FormInput({
		tag: 'input',
		type: 'text',
		placeholder,
		attributes: { list: id },
		appendTo: parent,
	});

	input.elem.value = value;

	// Populate asynchronously — dialog opens immediately, suggestions appear within ~100ms
	getCropSuggestions()
		.then(crops => {
			datalist.innerHTML = '';

			for (const crop of crops) {
				const opt = document.createElement('option');

				opt.value = crop;
				datalist.append(opt);
			}
		})
		.catch(() => {
			/* suggestions unavailable — static list in use */
		});

	return input;
};
