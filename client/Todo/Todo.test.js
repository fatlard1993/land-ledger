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

describe('a To Do card', () => {
	test('that goes somewhere is a link, an upcoming event to Timeline filtered to its field', () => {
		const view = new Todo({ appendTo: document.body });

		view._renderItem(
			{ title: 'Plant corn', href: '#/timeline?field=f1', icon: '🌽' },
			{ color: 'green', text: 'green' },
		);
		view._renderItem(
			{ title: 'Hay due', icon: '🐄', quickAction: { label: 'Mark fed', icon: 'check', fn: () => {} } },
			{ color: 'green', text: 'green' },
		);

		const [link, feeding] = [...view.content.elem.children].slice(-2);

		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('#/timeline?field=f1');
		expect(feeding.tagName).not.toBe('A');

		document.body.innerHTML = '';
	});

	test("an upcoming event's card carries its field in the address", () => {
		const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
		const todos = collect({
			_events: { body: { e1: { id: 'e1', fieldId: 'f1', date: future, category: 'crop', name: 'Plant corn' } } },
			_fields: { body: { f1: { id: 'f1', name: 'Pasture' } } },
		});

		expect(todos.find(item => item.title === 'Plant corn')?.href).toBe('#/timeline?field=f1');
	});
});
