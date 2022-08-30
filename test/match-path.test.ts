import { matchPath } from '../src';
import { describe, it, expect } from 'vitest';

const cases = {
  simple: {
    shouldMatch: [['/foo/:testId', '/foo/test', { testId: 'test' }]],
    shouldNotMatch: [['/foo/:testId', '/bar']],
  },
  hashed: {
    shouldMatch: [['/#/foo/:testId', '/#/foo/test', { testId: 'test' }]],
    shouldNotMatch: [['/#/foo/:testId', '/#/bar']],
  },
  full: {
    shouldMatch: [
      [
        'https://example.com/foo/:testId',
        'https://example.com/foo/test',
        { testId: 'test' },
      ],
    ],
    shouldNotMatch: [
      ['https://example.com/foo/:testId', 'https://example.com/bar'],
    ],
  },
} as const;

describe('Simple paths', () => {
  for (const [pathCreator, actualPath, params] of cases.simple.shouldMatch) {
    it('Match: path ' + pathCreator, () => {
      expect(matchPath({ pathCreator, actualPath })).toEqual({
        matches: true,
        params,
      });
    });
  }
  for (const [pathCreator, actualPath] of cases.simple.shouldNotMatch) {
    it('No match: path ' + pathCreator, () => {
      expect(matchPath({ pathCreator, actualPath })).toEqual({
        matches: false,
      });
    });
  }
});

describe('Hashed paths', () => {
  for (const [pathCreator, actualPath, params] of cases.hashed.shouldMatch) {
    it('Match: path ' + pathCreator, () => {
      expect(matchPath({ pathCreator, actualPath })).toEqual({
        matches: true,
        params,
      });
    });
  }
  for (const [pathCreator, actualPath] of cases.hashed.shouldNotMatch) {
    it('No match: path ' + pathCreator, () => {
      expect(matchPath({ pathCreator, actualPath })).toEqual({
        matches: false,
      });
    });
  }
});

describe('Full paths', () => {
  for (const [pathCreator, actualPath, params] of cases.full.shouldMatch) {
    it('Match: ' + pathCreator, () => {
      expect(matchPath({ pathCreator, actualPath })).toEqual({
        matches: true,
        params,
      });
    });
  }
  for (const [pathCreator, actualPath] of cases.full.shouldNotMatch) {
    it('No match: ' + pathCreator, () => {
      expect(matchPath({ pathCreator, actualPath })).toEqual({
        matches: false,
      });
    });
  }
});
