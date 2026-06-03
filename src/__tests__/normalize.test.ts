/**
 * Unit tests for resolveThemeSettings (Dual-Read normalization).
 *
 * Run with: npx vitest run src/__tests__/normalize.test.ts
 */

import { describe, it, expect } from 'vitest';
import { resolveThemeSettings } from '../utils/normalize';
import type { ThemeSettingsV3 } from '../types/theme';

describe('resolveThemeSettings', () => {
  describe('V3 passthrough', () => {
    it('returns V3 data as-is when schema_version is 3', () => {
      const v3: ThemeSettingsV3 = {
        schema_version: 3,
        theme_id: 'bazar',
        templates: {
          home: {
            name: 'Home',
            sections: {
              hero_1: { type: 'hero', disabled: false, settings: { title: 'Hello' }, blocks: {}, block_order: [] },
            },
            order: ['hero_1'],
          },
        },
        section_groups: {},
        global_settings: { primary_color: '#000' },
      };
      const result = resolveThemeSettings(v3 as unknown as Record<string, unknown>);
      expect(result.schema_version).toBe(3);
      expect(result.theme_id).toBe('bazar');
      expect(result.templates.home.sections.hero_1.settings.title).toBe('Hello');
    });
  });

  describe('V1 normalization', () => {
    it('normalizes V1 flat settings to V3', () => {
      const legacy = {
        theme: {
          base_theme: 'bazar',
          primary_color: '#ff0000',
          font_family: 'Inter',
        },
      };
      const result = resolveThemeSettings(legacy as any);
      expect(result.schema_version).toBe(3);
      expect(result.theme_id).toBe('bazar');
      expect(result.global_settings.primary_color).toBe('#ff0000');
    });

    it('generates default section groups for V1', () => {
      const legacy = { theme: { base_theme: 'modern' } };
      const result = resolveThemeSettings(legacy as any);
      expect(result.section_groups.header).toBeDefined();
      expect(result.section_groups.footer).toBeDefined();
    });

    it('normalizes V1 hero data into home template', () => {
      const legacy = {
        theme: { base_theme: 'bazar' },
        hero: {
          headline: 'Welcome',
          subtitle: 'Shop now',
          hero_image_url: '/hero.jpg',
        },
      };
      const result = resolveThemeSettings(legacy as any);
      expect(result.templates.home).toBeDefined();
      expect(result.templates.home.sections.hero_1).toBeDefined();
      expect(result.templates.home.sections.hero_1.settings.headline).toBe('Welcome');
    });

    it('preserves Arabic hero headline (parity with backend mapper)', () => {
      const legacy = {
        theme: { base_theme: 'bazar' },
        hero: {
          headline: 'Welcome',
          headline_ar: 'مرحبا',
        },
      };
      const result = resolveThemeSettings(legacy as any);
      const heroSettings = result.templates.home.sections.hero_1.settings;
      expect(heroSettings.headline_ar).toBe('مرحبا');
    });
  });

  describe('V2 normalization', () => {
    it('normalizes V2 with sections into V3 templates', () => {
      const legacy = {
        schema_version: 2,
        theme: { base_theme: 'modern' },
        hero: { headline: 'V2 Hero' },
      };
      const result = resolveThemeSettings(legacy as any);
      expect(result.schema_version).toBe(3);
      expect(result.theme_id).toBe('modern');
    });
  });

  describe('Edge cases', () => {
    it('handles null/undefined input gracefully', () => {
      const result = resolveThemeSettings(null as any);
      expect(result.schema_version).toBe(3);
      expect(result.theme_id).toBeDefined();
    });

    it('handles empty object input', () => {
      const result = resolveThemeSettings({} as any);
      expect(result.schema_version).toBe(3);
    });

    it('preserves external_theme metadata in V3', () => {
      const v3: ThemeSettingsV3 = {
        schema_version: 3,
        theme_id: 'custom',
        templates: {},
        section_groups: {},
        global_settings: {},
        external_theme: {
          bundle_url: 'https://cdn.example.com/theme.js',
          mode: 'production',
        },
      };
      const result = resolveThemeSettings(v3 as unknown as Record<string, unknown>);
      expect(result.external_theme?.bundle_url).toBe('https://cdn.example.com/theme.js');
    });
  });

  describe('V3 nested-block preservation', () => {
    // The dual-read passthrough must NOT strip nested blocks — the editor +
    // storefront depend on blocks-in-blocks surviving the read. This locks
    // the contract: if a future normalize step starts deep-walking V3, this
    // catches any block loss.
    it('returns a deeply-nested V3 payload intact', () => {
      const v3 = {
        schema_version: 3,
        theme_id: 'bon-younes-v3',
        global_settings: {},
        section_groups: {},
        templates: {
          home: {
            name: 'Home',
            order: ['footer_1'],
            sections: {
              footer_1: {
                type: 'by-footer',
                settings: {},
                block_order: ['col_1'],
                blocks: {
                  col_1: {
                    type: 'column',
                    settings: { heading: 'Shop' },
                    block_order: ['link_1'],
                    blocks: {
                      link_1: {
                        type: 'link',
                        settings: { url: '/products', label: 'All' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const result = resolveThemeSettings(v3 as unknown as Record<string, unknown>);
      const footer = result.templates.home.sections.footer_1 as Record<string, any>;
      const col = footer.blocks.col_1;
      expect(col.type).toBe('column');
      expect(col.block_order).toEqual(['link_1']);
      const link = col.blocks.link_1;
      expect(link.type).toBe('link');
      expect(link.settings.url).toBe('/products');
    });
  });

  describe('V1 products normalization (parity with backend mapper)', () => {
    it('maps a products block into a featured-products section', () => {
      const legacy = {
        theme: { base_theme: 'bazar' },
        products: { collection_id: 'abc', limit: 8 },
      };
      const result = resolveThemeSettings(legacy as any);
      expect(result.templates.home.sections.featured_1).toBeDefined();
      expect(result.templates.home.sections.featured_1.type).toBe(
        'featured-products',
      );
    });
  });
});
