import { describe, it, expect } from 'vitest';
import { safeStringify } from './logger';

describe('safeStringify', () => {
  it('serializes plain objects', () => {
    expect(safeStringify({ a: 1, b: 'two' })).toBe('{"a":1,"b":"two"}');
  });

  it('does not throw on circular references', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const out = safeStringify(a);
    expect(out).toContain('"name":"a"');
    expect(out).toContain('[Circular]');
  });

  it('represents Error objects with name, message and stack', () => {
    const out = safeStringify({ err: new Error('boom') });
    expect(out).toContain('"name":"Error"');
    expect(out).toContain('"message":"boom"');
  });

  it('handles an axios-like error with a circular agent without throwing', () => {
    const socket: any = { _httpMessage: {} };
    socket._httpMessage.agent = socket; // circular
    const axiosLike = { isAxiosError: true, code: 'ECONNREFUSED', request: { socket } };
    expect(() => safeStringify(axiosLike)).not.toThrow();
    expect(safeStringify(axiosLike)).toContain('ECONNREFUSED');
  });
});
