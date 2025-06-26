
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Config, Provider } from './config';

export interface ProviderStatus {
    id: string;
    model: string;
    endpoint: string;
    accessible: '✅' | '❌';
    supports_function_calling: '✅' | '❌' | 'N/A';
    supports_mcp: '✅' | '❌' | 'N/A';
    error?: string;
}

async function checkOpenAIProvider(provider: Provider, config: Config): Promise<ProviderStatus> {
    const { id, model } = provider;
    const apiKey = provider.api_key || config.api_key;
    const baseURL = provider.api_base_url || config.api_base_url;

    const status: ProviderStatus = {
        id,
        model,
        endpoint: baseURL || 'Default OpenAI',
        accessible: '❌',
        supports_function_calling: 'N/A',
        supports_mcp: 'N/A',
    };

    if (!apiKey) {
        status.error = 'API key is missing';
        return status;
    }

    try {
        const openai = new OpenAI({ apiKey, baseURL });
        await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: 'Health check' }],
            max_tokens: 1,
        });
        status.accessible = '✅';

        try {
            // Test for function calling (tool use)
            const toolUseResponse = await openai.chat.completions.create({
                model,
                messages: [
                    { role: 'user', content: 'What is the weather like in San Francisco?' }
                ],
                tools: [
                    { type: 'function', function: { name: 'get_current_weather', description: 'Get the current weather in a given location', parameters: { type: 'object', properties: { location: { type: 'string' } } } } }
                ],
                max_tokens: 50, // Limit tokens to prevent long responses
            });

            if (toolUseResponse.choices[0].message.tool_calls) {
                status.supports_function_calling = '✅';
                status.supports_mcp = '✅'; // If it supports tool_calls, it supports MCP
            } else {
                status.supports_function_calling = '❌';
                status.supports_mcp = '❌';
            }

        } catch (e: any) {
            status.supports_function_calling = '❌';
            status.supports_mcp = '❌';
        }

    } catch (error: any) {
        status.error = error.message.slice(0, 100) + '...';
    }

    return status;
}

async function checkAnthropicProvider(provider: Provider, config: Config): Promise<ProviderStatus> {
    const { id, model } = provider;
    const apiKey = provider.api_key || config.anthropic_api_key || config.api_key; // Allow specific anthropic key
    const baseURL = provider.api_base_url || config.anthropic_base_url;

    const status: ProviderStatus = {
        id,
        model,
        endpoint: baseURL || 'Default Anthropic',
        accessible: '❌',
        supports_function_calling: 'N/A',
        supports_mcp: 'N/A',
    };

    if (!apiKey) {
        status.error = 'API key is missing';
        return status;
    }

    try {
        const anthropic = new Anthropic({ apiKey, baseURL });
        await anthropic.messages.create({
            model,
            messages: [{ role: 'user', content: 'Health check' }],
            max_tokens: 1,
        });
        status.accessible = '✅';

        try {
            // Test for function calling (tool use)
            const toolUseMessage = await anthropic.messages.create({
                model,
                messages: [
                    { role: 'user', content: 'What time is it in New York?' }
                ],
                tools: [
                    { name: 'get_current_time', description: 'Gets the current time for a given location', input_schema: { type: 'object', properties: { location: { type: 'string' } } } }
                ],
                max_tokens: 50, // Limit tokens to prevent long responses
            });

            if (toolUseMessage.stop_reason === 'tool_use') {
                status.supports_function_calling = '✅';
                status.supports_mcp = '✅'; // If it supports tool_use, it supports MCP
            } else {
                status.supports_function_calling = '❌';
                status.supports_mcp = '❌';
            }
        } catch (e: any) {
            status.supports_function_calling = '❌';
            status.supports_mcp = '❌';
        }
    } catch (error: any) {
        status.error = error.message.slice(0, 100) + '...';
    }

    return status;
}

export async function checkProviders(config: Config): Promise<ProviderStatus[]> {
    const providersToCheck: Provider[] = [];
    
    // Add default provider if configured
    if (config.model) {
        providersToCheck.push({
            id: 'default',
            model: config.model,
            api_base_url: config.api_base_url,
            api_key: config.api_key,
        });
    }

    if (config.providers) {
        providersToCheck.push(...config.providers);
    }

    if (providersToCheck.length === 0) {
        return [];
    }
    
    const checks = providersToCheck.map(provider => {
        const isAnthropic = provider.model.includes('claude');
        if (isAnthropic) {
            return checkAnthropicProvider(provider, config);
        }
        return checkOpenAIProvider(provider, config);
    });

    return Promise.all(checks);
}
