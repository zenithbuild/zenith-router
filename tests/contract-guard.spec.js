// ---------------------------------------------------------------------------
// contract-guard.spec.js — Static Contract Guardrails
// ---------------------------------------------------------------------------
// ROUTER_CONTRACT.md invariants:
// - #4 Router prohibitions (no eval/new Function/document.write, no AST logic)
// - #8 No unauthorized window globals (history/popstate-only integration)
// - #9 No scroll/focus management
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Router Contract Guardrails (Static)', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const srcDir = path.resolve(__dirname, '../src');

    function readSources() {
        const files = fs.readdirSync(srcDir).filter((name) => name.endsWith('.js'));
        return files.map((name) => ({
            name,
            source: fs.readFileSync(path.join(srcDir, name), 'utf8')
        }));
    }

    test('does not use forbidden execution primitives', () => {
        const files = readSources();

        for (const file of files) {
            expect(file.source.includes('eval(')).toBe(false);
            expect(file.source.includes('new Function')).toBe(false);
            expect(file.source.includes('document.write')).toBe(false);
        }
    });

    test('uses window globals only for allowed history/popstate operations', () => {
        const files = readSources();
        const allowedRefs = new Set([
            'window.addEventListener',
            'window.removeEventListener',
            'window.location'
        ]);

        for (const file of files) {
            const refs = file.source.match(/window\.[a-zA-Z_$][\w$]*/g) || [];
            for (const ref of refs) {
                expect(allowedRefs.has(ref)).toBe(true);
            }
        }
    });

    test('contains no explicit scroll or focus management logic', () => {
        const files = readSources();
        const forbiddenPatterns = [
            'scrollTo(',
            'scrollIntoView(',
            'scrollRestoration',
            '.focus('
        ];

        for (const file of files) {
            for (const pattern of forbiddenPatterns) {
                expect(file.source.includes(pattern)).toBe(false);
            }
        }
    });
});
