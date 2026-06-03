export type PromptTemplates = {
  generalSystemPrompt: string;
  finalPromptSystemPrompt: string;
  stickerReplicationPrompt: string;
};

export type CliOptions = {
  imageModel: string;
  imageSize: string;
  inputPath: string;
  outputPath?: string;
  userPrompt: string;
  visionModel: string;
};

export type OutputPaths = {
  imagePath: string;
  imageInstructionPath: string;
  jsonPath: string;
};
