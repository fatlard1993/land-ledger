import { collectionDBs } from './database';
import { collectionStore } from './store';

const animals = collectionStore([
		'tagId', // ear tag, tattoo, or RFID — primary identifier
		'name', // optional name (Bessie, etc.)
		'species', // cattle | sheep | goat | pig | horse | chicken | alpaca | llama | other
		'breed',
		'sex', // female | male | castrated
		'birthDate',
		'dam', // dam's tagId or external name
		'sire', // sire's tagId or external name
		'fieldId', // current location
		'status', // active | deceased | sold | transferred
		'notes',
		'properties',
	], collectionDBs.animals);

export default animals;
