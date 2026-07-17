import { afterEach, describe, expect, it } from 'vitest';
import { isDemoMode } from './ai.js';

describe('isDemoMode', () => {
  const prevMode = process.env.DEMO_MODE;
  const prevProfile = process.env.DEMO_PROFILE;

  afterEach(() => {
    if (prevMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prevMode;
    if (prevProfile === undefined) delete process.env.DEMO_PROFILE;
    else process.env.DEMO_PROFILE = prevProfile;
  });

  it('returns true when DEMO_MODE is 1/true/yes/on (case-insensitive)', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on', ' On ']) {
      process.env.DEMO_MODE = v;
      delete process.env.DEMO_PROFILE;
      expect(isDemoMode(), `DEMO_MODE=${v}`).toBe(true);
    }
  });

  it('returns true when DEMO_PROFILE=demo', () => {
    delete process.env.DEMO_MODE;
    process.env.DEMO_PROFILE = 'demo';
    expect(isDemoMode()).toBe(true);
  });

  it('returns false when unset or non-truthy', () => {
    delete process.env.DEMO_MODE;
    delete process.env.DEMO_PROFILE;
    expect(isDemoMode()).toBe(false);

    process.env.DEMO_MODE = '0';
    expect(isDemoMode()).toBe(false);

    process.env.DEMO_MODE = 'false';
    expect(isDemoMode()).toBe(false);

    process.env.DEMO_PROFILE = 'prod';
    delete process.env.DEMO_MODE;
    expect(isDemoMode()).toBe(false);
  });
});
