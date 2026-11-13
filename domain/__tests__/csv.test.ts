import { parseCsv } from '../csv';

test('parseCsv reads plain rows', () => {
  expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
    ['a', 'b', 'c'],
    ['1', '2', '3'],
  ]);
});

test('parseCsv strips a BOM and accepts \\r\\n', () => {
  expect(parseCsv('﻿date,reps\r\n2026-11-01,8\r\n')).toEqual([
    ['date', 'reps'],
    ['2026-11-01', '8'],
  ]);
});

test('parseCsv keeps commas, quotes and line breaks inside quotes ("a, b" and "")', () => {
  expect(parseCsv('note,x\n"a, b",1\n"say ""hi""",2\n"two\nlines",3\n')).toEqual([
    ['note', 'x'],
    ['a, b', '1'],
    ['say "hi"', '2'],
    ['two\nlines', '3'],
  ]);
});

test('parseCsv keeps empty fields and skips blank lines', () => {
  expect(parseCsv('a,b,c\n\n1,,\n\r\n,,3')).toEqual([
    ['a', 'b', 'c'],
    ['1', '', ''],
    ['', '', '3'],
  ]);
  expect(parseCsv('')).toEqual([]);
});
