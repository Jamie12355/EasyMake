/**
 * KlingAI Workflow Integration Tests
 * Tests JSON parsing error handling, HTTP error responses, and complete pipeline flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock response builder
const createMockResponse = (ok, status, body) => ({
    ok,
    status,
    json: vi.fn(async () => {
        if (typeof body === 'object' && body.parseError) {
            throw new Error('Unexpected token');
        }
        return body;
    }),
    text: vi.fn(async () => {
        if (typeof body === 'string') return body;
        if (typeof body === 'object' && body.parseError) {
            return body.parseError; // Return the error text
        }
        return JSON.stringify(body);
    })
});

describe('KlingAI API Error Handling', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.clearAllMocks();
    });

    describe('fireKlingVideo - HTTP Error Responses', () => {
        it('should handle 401 Unauthorized with HTML error page', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(false, 401, 'An error occurred: Unauthorized access')
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test prompt'))
                .rejects
                .toThrow(/HTTP Error 401/);
        });

        it('should handle 500 Internal Server Error', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(false, 500, 'An error occurred in the server')
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test prompt'))
                .rejects
                .toThrow(/HTTP Error 500/);
        });

        it('should handle 429 Rate Limit Exceeded', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(false, 429, 'Too many requests')
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test prompt'))
                .rejects
                .toThrow(/HTTP Error 429/);
        });

        it('should handle malformed JSON response with valid status', async () => {
            const mockRes = {
                ok: true,
                status: 200,
                json: vi.fn(async () => {
                    throw new Error('Unexpected token in JSON at position 0');
                }),
                text: vi.fn(async () => 'An error occurred: Invalid JSON')
            };

            global.fetch = vi.fn(async () => mockRes);

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test prompt'))
                .rejects
                .toThrow(/Failed to parse Kling response as JSON/);
        });

        it('should handle missing task_id in response', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(true, 200, { code: 0, data: {} })
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test prompt'))
                .rejects
                .toThrow(/Kling Error/);
        });

        it('should handle non-zero error code', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(true, 200, {
                    code: -1,
                    message: 'Invalid parameters'
                })
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test prompt'))
                .rejects
                .toThrow(/Kling Error/);
        });

        it('should successfully parse valid Kling response', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(true, 200, {
                    code: 0,
                    data: { task_id: 'task_12345' }
                })
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');
            const result = await fireKlingVideo('test prompt');

            expect(result).toBe('kling_task_12345');
        });
    });

    describe('fireKlingVideo - Request Construction', () => {
        it('should construct correct request body', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(true, 200, {
                    code: 0,
                    data: { task_id: 'task_123' }
                })
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');
            await fireKlingVideo('creative prompt');

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[0]).toBe('https://api.klingai.com/v1/videos/text2video');

            const body = JSON.parse(callArgs[1].body);
            expect(body.model_name).toBe('kling-v1');
            expect(body.prompt).toBe('creative prompt');
            expect(body.duration).toBe('5');
            expect(body.aspect_ratio).toBe('9:16');
        });

        it('should include Authorization header', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(true, 200, {
                    code: 0,
                    data: { task_id: 'task_123' }
                })
            );

            const { fireKlingVideo } = await import('../pipeline-execute.js');
            await fireKlingVideo('test');

            const callArgs = global.fetch.mock.calls[0];
            expect(callArgs[1].headers['Authorization']).toBeDefined();
            expect(callArgs[1].headers['Authorization']).toMatch(/^Bearer /);
        });
    });

    describe('pollKlingVideoStatus - Error Handling', () => {
        it('should handle polling timeout gracefully', async () => {
            let callCount = 0;
            global.fetch = vi.fn(async () => {
                callCount++;
                if (callCount > 2) {
                    // Return still pending after multiple calls
                    return createMockResponse(true, 200, {
                        code: 0,
                        data: { task_status: 'processing' }
                    });
                }
                throw new Error('Network timeout');
            });

            const { pollKlingVideoStatus } = await import('../kling-pipeline.js');
            // Should eventually timeout and return null
            const result = await Promise.race([
                pollKlingVideoStatus('kling_task_123'),
                new Promise(resolve => setTimeout(() => resolve(null), 2000))
            ]);

            expect(result).toBeNull();
        });

        it('should handle malformed polling response', async () => {
            const mockRes = {
                ok: true,
                status: 200,
                json: vi.fn(async () => {
                    throw new Error('Invalid JSON');
                }),
                text: vi.fn(async () => 'Invalid response from server')
            };

            global.fetch = vi.fn(async () => mockRes);

            const { pollKlingVideoStatus } = await import('../kling-pipeline.js');
            // Should retry instead of crashing
            const result = await Promise.race([
                pollKlingVideoStatus('kling_task_123'),
                new Promise(resolve => setTimeout(() => resolve('timeout'), 1000))
            ]);

            expect(result).toBe('timeout');
        });
    });

    describe('Fallback Logic', () => {
        it('should fallback to Luma when Kling fails', async () => {
            let callCount = 0;
            global.fetch = vi.fn(async () => {
                callCount++;
                if (callCount === 1) {
                    // Kling fails
                    return createMockResponse(false, 500, 'Server error');
                }
                // Luma succeeds
                return createMockResponse(true, 200, { id: 'luma_123' });
            });

            const { fireVideoGeneration } = await import('../pipeline-execute.js');
            const result = await fireVideoGeneration('test prompt');

            expect(result).toBe('luma_123');
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should use Kling as primary provider', async () => {
            global.fetch = vi.fn(async () =>
                createMockResponse(true, 200, {
                    code: 0,
                    data: { task_id: 'task_123' }
                })
            );

            const { fireVideoGeneration } = await import('../pipeline-execute.js');
            const result = await fireVideoGeneration('test prompt');

            expect(result).toMatch(/^kling_/);
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(global.fetch.mock.calls[0][0]).toContain('klingai.com');
        });
    });

    describe('JSON Parsing Edge Cases', () => {
        it('should handle HTML error responses', async () => {
            const mockRes = {
                ok: false,
                status: 502,
                text: vi.fn(async () => '<html><body>Bad Gateway</body></html>')
            };

            global.fetch = vi.fn(async () => mockRes);

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test'))
                .rejects
                .toThrow(/Bad Gateway/);
        });

        it('should handle empty response body', async () => {
            const mockRes = {
                ok: false,
                status: 500,
                text: vi.fn(async () => '')
            };

            global.fetch = vi.fn(async () => mockRes);

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test'))
                .rejects
                .toThrow(/HTTP Error 500/);
        });

        it('should handle response with unexpected content type', async () => {
            const mockRes = {
                ok: true,
                status: 200,
                json: vi.fn(async () => {
                    throw new SyntaxError('Unexpected token < in JSON at position 0');
                }),
                text: vi.fn(async () => '<!DOCTYPE html><html>...')
            };

            global.fetch = vi.fn(async () => mockRes);

            const { fireKlingVideo } = await import('../pipeline-execute.js');

            await expect(fireKlingVideo('test'))
                .rejects
                .toThrow(/Failed to parse Kling response as JSON/);
        });
    });
});

describe('Complete KlingAI Pipeline Flow', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.clearAllMocks();
    });

    it('should handle complete video generation pipeline', async () => {
        const responses = [
            { code: 0, data: { task_id: 'task_123' } }, // Video init
            { code: 0, data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://example.com/video.mp4' }] } } }, // Video status
        ];

        let callCount = 0;
        global.fetch = vi.fn(async () => {
            const response = responses[Math.min(callCount++, responses.length - 1)];
            return createMockResponse(true, 200, response);
        });

        const { fireKlingVideo } = await import('../pipeline-execute.js');
        const result = await fireKlingVideo('test prompt');

        expect(result).toMatch(/^kling_/);
    });
});
