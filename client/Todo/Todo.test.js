import { describe, expect, test } from 'bun:test';

import Todo from './Todo';

const collect = data => Object.assign(Object.create(Todo.prototype), data)._collectTodos();

describe('todos', () => {
	test('within a tier, feeding comes before maintenance before incidents', () => {
		const todos = collect({
			_equipment: { body: { e1: { id: 'e1', name: 'Tractor', status: 'needs_service', emoji: '🚛' } } },
			_incidents: { body: { i1: { id: 'i1', type: 'Equipment breakdown', severity: 'major', entityName: 'North' } } },
			_fields: { body: { f1: { id: 'f1', name: 'Pasture' } } },
			_feedingSchedules: { body: { s1: { id: 's1', fieldId: 'f1', feedType: 'Hay', frequency: 'twice_daily' } } },
			_feedingLogs: { body: {} },
		});

		expect(todos.map(({ kind }) => kind)).toEqual(['feeding', 'maintenance', 'incident']);
	});
});
