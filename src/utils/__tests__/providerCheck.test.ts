import { checkProviders } from '../providerCheck';
import { loadConfig } from '../config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('../config');
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;
const mockAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe('checkProviders', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return empty array if no providers are configured', async () => {
        mockLoadConfig.mockReturnValue({
            // @ts-ignore
            providers: [],
        });

        const result = await checkProviders(mockLoadConfig('./'));
        expect(result).toEqual([]);
    });

    it('should check OpenAI provider correctly with function calling and MCP support', async () => {
        mockLoadConfig.mockReturnValue({
            // @ts-ignore
            api_key: 'test-openai-key',
            providers: [
                {
                    id: 'openai-test',
                    model: 'gpt-4',
                    api_base_url: 'https://api.openai.com/v1',
                    api_key: 'test-openai-provider-key',
                },
            ],
        });

        mockOpenAI.mockImplementation(() => {
            return {
                chat: {
                    completions: {
                        create: jest.fn().mockImplementation((params) => {
                            if (params.tools) {
                                return Promise.resolve({
                                    choices: [{
                                        message: { tool_calls: [{ function: { name: 'get_current_weather' } }] }
                                    }]
                                });
                            }
                            return Promise.resolve({ choices: [{ message: { content: 'ok' } }] });
                        }),
                    },
                },
            } as any;
        });

        const result = await checkProviders(mockLoadConfig('./'));
        expect(result).toEqual([
            expect.objectContaining({
                id: 'openai-test',
                model: 'gpt-4',
                accessible: '✅',
                supports_function_calling: '✅',
                supports_mcp: '✅',
            }),
        ]);
    });

    it('should check Anthropic provider correctly with tool use and MCP support', async () => {
        mockLoadConfig.mockReturnValue({
            // @ts-ignore
            anthropic_api_key: 'test-anthropic-key',
            providers: [
                {
                    id: 'anthropic-test',
                    model: 'claude-3-opus-20240229',
                    api_base_url: 'https://api.anthropic.com',
                    api_key: 'test-anthropic-provider-key',
                },
            ],
        });

        mockAnthropic.mockImplementation(() => {
            return {
                messages: {
                    create: jest.fn().mockImplementation((params) => {
                        if (params.tools) {
                            return Promise.resolve({
                                stop_reason: 'tool_use',
                                content: [],
                            });
                        }
                        return Promise.resolve({ content: 'ok' });
                    }),
                },
            } as any;
        });

        const result = await checkProviders(mockLoadConfig('./'));
        expect(result).toEqual([
            expect.objectContaining({
                id: 'anthropic-test',
                model: 'claude-3-opus-20240229',
                accessible: '✅',
                supports_function_calling: '✅',
                supports_mcp: '✅',
            }),
        ]);
    });

    it('should handle inaccessible OpenAI provider', async () => {
        mockLoadConfig.mockReturnValue({
            // @ts-ignore
            api_key: 'test-openai-key',
            providers: [
                {
                    id: 'openai-fail',
                    model: 'gpt-4',
                    api_base_url: 'https://api.openai.com/v1',
                    api_key: 'test-openai-provider-key',
                },
            ],
        });

        mockOpenAI.mockImplementation(() => {
            return {
                chat: {
                    completions: {
                        create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
                    },
                },
            } as any;
        });

        const result = await checkProviders(mockLoadConfig('./'));
        expect(result).toEqual([
            expect.objectContaining({
                id: 'openai-fail',
                model: 'gpt-4',
                accessible: '❌',
                error: expect.any(String),
            }),
        ]);
    });

    it('should handle inaccessible Anthropic provider', async () => {
        mockLoadConfig.mockReturnValue({
            // @ts-ignore
            anthropic_api_key: 'test-anthropic-key',
            providers: [
                {
                    id: 'anthropic-fail',
                    model: 'claude-3-opus-20240229',
                    api_base_url: 'https://api.anthropic.com',
                    api_key: 'test-anthropic-provider-key',
                },
            ],
        });

        mockAnthropic.mockImplementation(() => {
            return {
                messages: {
                    create: jest.fn().mockRejectedValue(new Error('Anthropic API error')),
                },
            } as any;
        });

        const result = await checkProviders(mockLoadConfig('./'));
        expect(result).toEqual([
            expect.objectContaining({
                id: 'anthropic-fail',
                model: 'claude-3-opus-20240229',
                accessible: '❌',
                error: expect.any(String),
            }),
        ]);
    });
});
