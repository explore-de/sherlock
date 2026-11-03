import Ajv from 'ajv';
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { indexSchema } from '@sherlock/schemas/v3/index.schema';
import { SherlockConfig } from '@sherlock/schemas/v3/index.type';
import { ModelConfig } from '@sherlock/schemas/v3/model.type';
import { env } from '@/env.mjs';

export type AiModelConfig = ModelConfig & {
    /** Stable, non-secret identifier for the model. */
    id: string;
};

const ajv = new Ajv({
    validateFormats: false,
});

const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

const readConfig = async (configPath: string) => {
    if (isRemotePath(configPath)) {
        const response = await fetch(configPath, { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) {
            throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
        }
        return response.text();
    }

    return readFile(configPath, {
        encoding: 'utf-8',
    });
}

const loadAiModels = async (): Promise<AiModelConfig[]> => {
    const configPath = env.CONFIG_PATH;
    if (!configPath) {
        return [];
    }

    try {
        const config = JSON.parse(stripJsonComments(await readConfig(configPath))) as SherlockConfig;
        if (!ajv.validate(indexSchema, config)) {
            throw new Error(`Config file '${configPath}' is invalid: ${ajv.errorsText(ajv.errors)}`);
        }

        return (config.models ?? []).map((model) => ({
            ...model,
            id: `${model.provider}/${model.model}`,
        }));
    } catch (error) {
        console.error(`Failed to load AI models from '${configPath}': ${error}`);
        return [];
    }
}

// The model config is static server config; a process restart is required to pick
// up changes to it.
let aiModels: Promise<AiModelConfig[]> | undefined = undefined;

export const getAiModels = (): Promise<AiModelConfig[]> => {
    if (!aiModels) {
        aiModels = loadAiModels();
    }
    return aiModels;
}

// AI search has no model picker yet, so the first configured model is
// always the one used. See `schemas/v3/model.json` for the documented
// convention.
export const getAiModel = async (): Promise<AiModelConfig | undefined> => {
    const models = await getAiModels();
    return models[0];
}
