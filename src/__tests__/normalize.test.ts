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
      const result = resolveThemeSettings(v3);
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
      const result = resolveThemeSettings(v3);
      expect(result.external_theme?.bundle_url).toBe('https://cdn.example.com/theme.js');
    });
  });
});
