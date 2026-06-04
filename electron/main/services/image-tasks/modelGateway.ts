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
      return client.executeImage({
        ...input,
        model: input.plan.executionStage.model,
        images: input.plan.executionImages,
        count: input.plan.count,
        aspectRatio: input.plan.outputAspectRatio,
        size: input.plan.openaiImageSize,
      });
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
