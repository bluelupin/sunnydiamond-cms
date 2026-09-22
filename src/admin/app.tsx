import type { StrapiApp } from '@strapi/strapi/admin';
import type { ComponentType } from 'react';
import { PolicySlugInput } from './components/PolicySlugInput';
import { AppointmentDetails } from './components/AppointmentDetails';
import { GenericSubmissionField } from './components/GenericSubmissionField';
import './styles/read-only-appointment-relations.css';

const CHUNK_RELOAD_KEY = 'strapi-admin-chunk-reload';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

const reloadAfterStaleChunk = () => {
  const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);

  if (Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return;

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
};

export default {
  config: {},
  register(app: StrapiApp) {
    app.addFields({ type: 'policy-slug', Component: PolicySlugInput as ComponentType });
    app.addFields({ type: 'appointment-details', Component: AppointmentDetails as ComponentType });
    app.addFields({ type: 'generic-submission-field', Component: GenericSubmissionField as ComponentType });
  },
  bootstrap(app: { registerHook: (name: string, handler: (args: any) => any) => void }) {
    app.registerHook('Admin/CM/pages/EditView/mutate-edit-view-layout', (args) => {
      if (args.layout.settings?.displayName !== 'Submissions: Job Opening') return args;
      const editable = new Set(['workflowStatus', 'internalNotes']);
      const components = Object.fromEntries(Object.entries(args.layout.components ?? {}).map(([uid, component]: [string, any]) => [
        uid,
        { ...component, layout: component.layout.map((row: any[]) => row.map(field => ({ ...field, disabled: true }))) },
      ]));
      return { ...args, layout: { ...args.layout, components,
        layout: args.layout.layout.map((panel: any[][]) => panel.map((row: any[]) => row.map((field: any) =>
          editable.has(field.name) ? field : { ...field, disabled: true }
        ))),
      } };
    });
    app.registerHook('Admin/CM/pages/EditView/mutate-edit-view-layout', (args) => {
      if (args.layout.settings?.displayName !== 'Submissions: Generic') return args;
      return { ...args, layout: { ...args.layout,
        layout: args.layout.layout.map((panel: any[][]) => panel.map(row => row.map(field =>
          field.name === 'preferredShowroom'
            ? { ...field, disabled: true }
            : !['internalNotes', 'workflowStatus'].includes(field.name) &&
          ['string', 'email', 'text', 'date', 'boolean'].includes(field.attribute?.type)
            ? { ...field, type: 'generic-submission-field' } : field,
        ))),
      } };
    });
    app.registerHook('Admin/CM/pages/EditView/mutate-edit-view-layout', (args) => ({
      ...args,
      layout: {
        ...args.layout,
        layout: args.layout.layout.map((panel: any[][]) => panel.map((row) => row
          .filter((field) => field.name !== 'rescheduleHistory')
          .map((field) =>
          ['previousData', 'newData'].includes(field.name) && field.attribute?.type === 'json'
              ? { ...field, type: 'appointment-details', size: 12 }
              : field
        )).filter(row => row.length > 0)).filter((panel: any[][]) => panel.length > 0),
      },
    }));
    app.registerHook('Admin/CM/pages/EditView/mutate-edit-view-layout', (args) => {
      const components = { ...args.layout.components };
      for (const uid of ['shared.policy-category', 'shared.policy-entry']) {
        const component = components[uid];
        if (!component) continue;
        components[uid] = {
          ...component,
          layout: component.layout.map((row: { name: string }[]) =>
            row.map((field) => field.name === 'slug'
              ? { ...field, type: 'policy-slug' }
              : field)
          ),
        };
      }

      return {
        ...args,
        layout: {
          ...args.layout,
          components,
        },
      };
    });
    app.registerHook('Admin/CM/pages/EditView/mutate-edit-view-layout', (args) => {
      const component = args.layout.components?.['shared.showroom-section'];
      if (!component) return args;

      const isVisitSection = args.layout.layout.some((panel: any[][]) =>
        panel.some((row) => row.some((field) =>
          field.name === 'visitSection' &&
          field.attribute?.component === 'shared.showroom-section'
        ))
      );
      const hiddenFields = isVisitSection
        ? ['showrooms', 'cta']
        : ['backgroundImage', 'welcomeNote', 'appointmentLabel'];

      return {
        ...args,
        layout: {
          ...args.layout,
          components: {
            ...args.layout.components,
            'shared.showroom-section': {
              ...component,
              layout: component.layout
                .map((row: { name: string }[]) => row.filter((field) => !hiddenFields.includes(field.name)))
                .filter((row: { name: string }[]) => row.length > 0),
            },
          },
        },
      };
    });

    window.addEventListener('vite:preloadError', (event) => {
      event.preventDefault();
      reloadAfterStaleChunk();
    });

    window.addEventListener('unhandledrejection', (event) => {
      const message = String(event.reason?.message ?? event.reason ?? '');
      const isStaleChunk =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('error loading dynamically imported module');

      if (!isStaleChunk) return;

      event.preventDefault();
      reloadAfterStaleChunk();
    });
  },
};
