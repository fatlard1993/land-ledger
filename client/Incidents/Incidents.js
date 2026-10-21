import { Component, Elem, EmptyState, formatDate, SectionLabel, styled, Toolbar } from '@vanilla-bean/components';

import AsyncView from '../AsyncView';

import { getIncidents, updateIncident, deleteIncident } from '../api';
import context from '../context';
import { PageView, RecordCard } from '../Layout';
import IncidentDialog, { incidentEmoji, severityMeta } from './IncidentDialog';

const TitleRow = styled(
	Component,
	() => `
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 4px;
	`,
);

const Severity = styled(
	Component,
	() => `
		flex-shrink: 0;
		font-size: 11px;
		font-weight: 600;
	`,
	{ tag: 'span' },
);

const Description = styled(
	Component,
	({ colors }) => `
		margin-top: 4px;
		overflow: hidden;
		font-size: 12px;
		color: ${colors.gray};
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
);

const Loss = styled(
	Component,
	({ colors }) => `
		margin-top: 2px;
		font-size: 12px;
		color: ${colors.light(colors.orange)};
	`,
);

const entityIcon = type => ({ field: '📋', building: '🏚️', equipment: '🚜' })[type] || '📋';

export default class Incidents extends AsyncView {
	_buildView() {
		this.toolbar = new Toolbar({ appendTo: this, variant: 'bar', heading: 'Incidents', gap: 8, wrap: false });

		this.content = new PageView({ appendTo: this });
	}

	_datasources() {
		return { incidents: getIncidents };
	}

	_onData() {
		this._renderList();
	}

	_renderList() {
		this.content.empty();

		const all = Object.values(this.incidents?.body || {}).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

		context.hasIncidents = all.length > 0;

		if (!all.length) {
			new EmptyState({
				appendTo: this.content,
				icon: 'triangle-exclamation',
				title: 'No incidents recorded',
				message: 'Incidents are logged from the field, building, or equipment panel on the map',
			});
			return;
		}

		const open = all.filter(i => !i.resolved);
		const resolved = all.filter(i => i.resolved);

		if (open.length) {
			new SectionLabel({ appendTo: this.content, textContent: 'Open' });
			for (const incident of open) this._renderCard(incident);
		}

		if (resolved.length) {
			new SectionLabel({ appendTo: this.content, textContent: 'Resolved' });
			for (const incident of resolved) this._renderCard(incident);
		}
	}

	_renderCard(incident) {
		const severity = severityMeta(incident.severity);

		const card = new RecordCard({
			appendTo: this.content,
			onPointerPress: () =>
				new IncidentDialog({
					incident,
					onSave: async data => {
						const result = await updateIncident(incident.id, { body: { ...data, _v: incident._v } });

						if (result?.status === 'error') return result;

						if (result?.body && this.incidents?.body) {
							this.incidents.body[incident.id] = result.body;
							this._renderList();
						}
					},
					onDelete: async () => {
						const result = await deleteIncident(incident.id);

						if (result?.status === 'error') return result;

						if (this.incidents?.body) delete this.incidents.body[incident.id];
						context.hasIncidents = Object.keys(this.incidents?.body || {}).length > 0;
						this._renderList();
					},
				}),
		});

		const titleRow = new TitleRow({ appendTo: card });

		new Elem({
			tag: 'div',
			appendTo: titleRow,
			addClass: 'card-title',
			textContent: `${incidentEmoji(incident.type)} ${incident.type || 'Incident'}`,
		});

		new Severity({ appendTo: titleRow, style: { color: severity.color }, textContent: severity.label });

		const meta = new Elem({ tag: 'div', appendTo: card, addClass: 'card-meta' });

		if (incident.entityName) {
			new Elem({
				tag: 'span',
				appendTo: meta,
				textContent: `${entityIcon(incident.entityType)} ${incident.entityName}`,
			});
		}

		if (incident.date) new Elem({ tag: 'span', appendTo: meta, textContent: formatDate(incident.date) });

		if (incident.description) {
			new Description({ appendTo: card, textContent: incident.description });
		}

		if (incident.estimatedLoss) {
			new Loss({ appendTo: card, textContent: `Est. loss: $${Number(incident.estimatedLoss).toLocaleString()}` });
		}
	}
}
