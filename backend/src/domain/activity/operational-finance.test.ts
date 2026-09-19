import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  amountsDisagree,
  calculateFuelAmount,
  calculatePerDiem,
  teamMemberCalculatedTotal,
} from './operational-finance.js';

test('per diem is rate × frequency', () => {
  assert.equal(calculatePerDiem(50000, 4), 200000);
});

test('fuel amount is litres × rate', () => {
  assert.equal(calculateFuelAmount(40, 5500), 220000);
});

test('team member total sums per diem, airtime and fuel', () => {
  assert.equal(teamMemberCalculatedTotal({ rate: 30000, frequency: 3, airtimeData: 10000, fuelAllocation: 50000 }), 150000);
});

test('supplied vs calculated discrepancy is detected', () => {
  assert.equal(amountsDisagree(100, 100), false);
  assert.equal(amountsDisagree(100, 105), true);
});
