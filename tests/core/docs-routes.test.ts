import { existsSync } from 'node:fs';
import { expect, test } from 'vitest';
import { routes } from '../../docs/src/routes';
import { legacyRoutes, resolveLocation } from '../../docs/src/router';
import { sourceAliases } from '../../docs/source-aliases';
import pkg from '../../package.json';

test('every feature has a unique route and real implementation/test pointers', () => {
  expect(new Set(routes.map((route) => route.path)).size).toBe(routes.length);
  for (const route of routes) {
    expect(existsSync(route.source), route.source).toBe(true);
    expect(existsSync(route.test), route.test).toBe(true);
  }
});

test('legacy links resolve to real routes and malformed hashes remain safe', () => {
  for (const [hash, path] of Object.entries(legacyRoutes)) {
    expect(routes.some((route) => route.path === path)).toBe(true);
    expect(resolveLocation('/', '#' + hash)).toBe(path);
  }
  expect(resolveLocation('/three/')).toBe('/three');
  expect(resolveLocation('/', '#%')).toBe('/');
  expect(resolveLocation('/missing')).toBe('/missing');
});

test('every package entry resolves to source in docs and unit tests', () => {
  for (const entry of Object.keys(pkg.exports)) {
    const name = '@dhaakon/motion' + entry.slice(1);
    const matches = sourceAliases.filter((alias) => alias.find.test(name));
    expect(matches, name).toHaveLength(1);
    expect(existsSync(matches[0].replacement)).toBe(true);
  }
});
