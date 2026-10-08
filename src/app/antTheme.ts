import { theme, type ThemeConfig } from 'antd';

/**
 * Ant Design supplies the form controls' behaviour and accessibility; these
 * tokens make them look like part of Pirate Battle (navy fields, brass
 * accents, cream text) instead of a default web form.
 */
export const pirateTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#f2c35b',
    colorText: '#f8ecd2',
    colorTextPlaceholder: '#c9bda4',
    colorBgContainer: 'rgba(8, 19, 31, 0.55)',
    colorBgElevated: '#182a3f',
    colorBorder: 'rgba(248, 236, 210, 0.28)',
    colorError: '#ff8f7a',
    borderRadius: 8,
    controlHeight: 38,
    fontSize: 15,
    fontFamily: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
  },
  components: {
    Select: {
      optionSelectedBg: 'rgba(242, 195, 91, 0.2)',
      optionActiveBg: 'rgba(248, 236, 210, 0.08)',
      optionSelectedColor: '#f2c35b',
    },
    InputNumber: {
      activeShadow: '0 0 0 2px rgba(255, 224, 138, 0.45)',
    },
    Input: {
      activeShadow: '0 0 0 2px rgba(255, 224, 138, 0.45)',
    },
  },
};
