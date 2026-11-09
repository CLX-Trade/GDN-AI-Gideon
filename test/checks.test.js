import test from 'node:test';
import assert from 'node:assert/strict';
import { checkImo, checkContainer, checkIban, checkBic, checkLei, checkAbn, checkAcn, checkIncoterm } from '../shared/checks.js';

test('IMO: published example passes, one wrong digit fails', () => {
  assert.equal(checkImo('IMO 9074729').valid, true);
  assert.equal(checkImo('9074729').valid, true);
  const bad = checkImo('IMO 9074728');
  assert.equal(bad.valid, false);
  assert.equal(bad.expected, 9);
  assert.equal(checkImo('123').valid, false);
});

test('ISO 6346 container: standard example passes, typos fail', () => {
  assert.equal(checkContainer('CSQU3054383').valid, true);
  assert.equal(checkContainer('csqu 305438-3').valid, true);
  assert.equal(checkContainer('CSQU3054384').valid, false);
  assert.equal(checkContainer('CSQX3054383').valid, false, 'category must be U, J or Z');
  assert.equal(checkContainer('CSQU305438').valid, false);
});

test('IBAN: real-format examples pass, tampered ones fail', () => {
  assert.equal(checkIban('GB82 WEST 1234 5698 7654 32').valid, true);
  assert.equal(checkIban('DE89370400440532013000').valid, true);
  assert.equal(checkIban('GB82WEST12345698765433').valid, false);
  assert.equal(checkIban('GB82WEST123456987654').valid, false, 'wrong length');
  assert.equal(checkIban('US64SVBKUS6S3300958879').valid, false, 'the US does not issue IBANs');
});

test('BIC: shape, country and test codes', () => {
  const ok = checkBic('OCBCSGSG');
  assert.equal(ok.valid, true);
  assert.equal(ok.country, 'SG');
  assert.equal(checkBic('DEUTDEFF500').valid, true);
  assert.equal(checkBic('DEUTDE').valid, false);
  assert.equal(checkBic('ABCDZZ22').valid, false, 'ZZ is not a country');
  assert.equal(checkBic('ABCDGB20').isTestCode, true);
});

test('LEI: valid example passes, tampered fails', () => {
  assert.equal(checkLei('5493001KJTIIGC8Y1R12').valid, true);
  assert.equal(checkLei('5493001KJTIIGC8Y1R13').valid, false);
  assert.equal(checkLei('SHORT').valid, false);
});

test('ABN and ACN: GDN own ACN passes, ATO example ABN passes', () => {
  assert.equal(checkAcn('666 495 263').valid, true);
  assert.equal(checkAcn('666 495 264').valid, false);
  assert.equal(checkAbn('51 824 753 556').valid, true);
  assert.equal(checkAbn('51 824 753 557').valid, false);
});

test('Incoterms: 2020 rules pass, retired ones are named', () => {
  assert.equal(checkIncoterm('CIF Brisbane').normalized, 'CIF');
  assert.equal(checkIncoterm('fob santos').valid, true);
  assert.equal(checkIncoterm('DDU Rotterdam').valid, false);
  assert.equal(checkIncoterm('no term here').valid, false);
});
