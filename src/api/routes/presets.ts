import { Elysia, t } from 'elysia';
import { PRESETS, listPresets } from '../../extractors/presets/index.ts';

export const presetsRoutes = new Elysia()
  // No auth — discovery endpoint
  .get('/v1/presets', () => ({ presets: listPresets() }))
  .get('/v1/presets/:id', ({ params, set }) => {
    const preset = PRESETS[params.id];
    if (!preset) {
      set.status = 404;
      return { error: `Preset "${params.id}" not found. GET /v1/presets for the full list.` };
    }
    const { postProcess: _, ...serialisable } = preset;
    return serialisable;
  }, {
    params: t.Object({ id: t.String() }),
  });
