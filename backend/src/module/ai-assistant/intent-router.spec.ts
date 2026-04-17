import { INTENT, routeIntent } from './intent-router';

describe('intent-router', () => {
  it('does not ask date again when user writes "ngay 23"', () => {
    const routed = routeIntent(
      'ngay 23 co lich trong cua khoa co xuong khop khong',
    );

    expect(routed.intent).toBe(INTENT.DOCTOR_SLOTS);
    expect(routed.missingParams).not.toContain('date');
    expect(routed.extracted.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('routes "lich trong" queries to DOCTOR_SLOTS and asks for date when missing', () => {
    const routed = routeIntent('ban co lich trong nao khong');

    expect(routed.intent).toBe(INTENT.DOCTOR_SLOTS);
    expect(routed.missingParams).toContain('date');
  });

  it('extracts date from DD/MM without year', () => {
    const routed = routeIntent('co lich trong ngay 23/04 khong');

    expect(routed.intent).toBe(INTENT.DOCTOR_SLOTS);
    expect(routed.missingParams).not.toContain('date');
    expect(routed.extracted.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('extracts specialty keyword with hyphenated phrase', () => {
    const routed = routeIntent(
      'bac si chuyen khoa co - xuong - khop co lich trong ngay mai khong',
    );

    expect(routed.intent).toBe(INTENT.DOCTOR_SLOTS);
    expect(routed.extracted.date).toBeTruthy();
    expect(routed.extracted.searchKeyword).toBe('co xuong khop');
  });
});
