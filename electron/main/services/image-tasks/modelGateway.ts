import type { ImageModelProtocol } from '../../../../src/shared/domain/imageFeatureApi.js';
import type { OpenAIImageSize } from '../../../../src/shared/domain/imageAspectRatio.js';
import type {
  ExecuteImageInput,
  GenerateInstructionInput,
  ImageExecutionModelResult,
  ImageTaskModelGateway,
} from './imageTaskExecutor.js';

export interface ModelInstructionClientInput extends GenerateInstructionInput {
  model: string;
  images: GenerateInstructionInput['plan']['instructionImages'];
  systemPrompt: string;
}

export interface ModelExecutionClientInput extends ExecuteImageInput {
  model: string;
  images: ExecuteImageInput['plan']['executionImages'];
  count: number;
  aspectRatio?: string;
  size?: OpenAIImageSize;
}

export interface ProtocolModelClient {
  generateInstruction(input: ModelInstructionClientInput): Promise<string>;
  executeImage(input: ModelExecutionClientInput): Promise<ImageExecutionModelResult>;
}

export type ProtocolModelClients = Partial<Record<ImageModelProtocol, ProtocolModelClient>>;

export function createProtocolModelGateway(clients: ProtocolModelClients): ImageTaskModelGateway {
  return {
    async generateInstruction(input) {
      const client = resolveClient(clients, input.plan.instructionStage.protocol);
      return client.generateInstruction({
        ...input,
        model: input.plan.instructionStage.model,
        images: input.plan.instructionImages,
        systemPrompt: input.plan.instructionSystemPrompt,
      });
    },

    async executeImage(input) {
      const client = resolveClient(clients, input.plan.executionStage.protocol);
      const executionInput: ModelExecutionClientInput = {
        ...input,
        model: input.plan.executionStage.model,
        images: input.plan.executionImages,
        count: 1,
        aspectRatio: input.plan.outputAspectRatio,
        size: input.plan.openaiImageSize,
      };

      const images: ImageExecutionModelResult['images'] = [];
      const textNotes: string[] = [];
      const warnings: string[] = [];

      for (let index = 0; index < input.plan.count; index += 1) {
        const result = await client.executeImage(executionInput);
        images.push(...result.images);
        if (result.textNotes?.length) {
          textNotes.push(...result.textNotes);
        }
        if (result.warnings?.length) {
          warnings.push(...result.warnings);
        }
      }

      if (images.length === 0) {
        throw new Error('image model returned no usable image output');
      }

      return {
        images,
        textNotes: textNotes.length > 0 ? textNotes : undefined,
        warnings,
      };
    },
  };
}

function resolveClient(clients: ProtocolModelClients, protocol: ImageModelProtocol) {
  const client = clients[protocol];
  if (!client) {
    throw new Error(`${protocol} model client is not configured`);
  }

  return client;
}
