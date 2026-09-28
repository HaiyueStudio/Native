import test from 'node:test';import assert from 'node:assert/strict';
import {scanText} from '../bridge/scanner/types.ts';
test('scanner treats QR data as inert bounded text',()=>{assert.deepEqual(scanText('https://example.com'),{text:'https://example.com',format:'qr'});for(const value of ['',null,{},'a'.repeat(8193)])assert.throws(()=>scanText(value));assert.equal(scanText('😀',{maxTextLength:2}).text,'😀');assert.throws(()=>scanText('123',{maxTextLength:2}));assert.throws(()=>scanText('x',{maxTextLength:-1}));});
