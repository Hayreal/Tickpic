export type PromptTemplates = {
  generalSystemPrompt: string;
  jsonSystemPrompt: string;
  stickerReplicationPrompt: string;
};

export type PromptEnhancement = {
  feature: string;
  taskIntent: string;
  sourceImageUnderstanding: {
    mainSubject: string;
    scene: string;
    style: string;
    colorPalette: string;
    composition: string;
    lighting: string;
    materialTexture: string;
    textAreas: string[];
    commercialUse: string;
  };
  regionUnderstanding: Array<{
    regionLabel: string;
    targetObject: string;
    operationBoundary: string;
    notes: string;
  }>;
  subjectPlan: {
    keep: string[];
    remove: string[];
    replace: string[];
    generate: string[];
  };
  compositionPlan: {
    layout: string;
    cameraAngle: string;
    visualHierarchy: string;
    comparisonStructure: string;
  };
  stylePlan: {
    visualStyle: string;
    colorScheme: string;
    marketStyle: string;
  };
  textPlan: {
    primaryText: string[];
    secondaryText: string[];
    textAccuracyRequirement: string;
    avoidText: string[];
  };
  additionalPromptUnderstanding: {
    acceptedRequirements: string[];
    conflictingRequirements: string[];
    mergedIntoFinalPrompt: string[];
  };
  scenePlan: {
    sceneList: string[];
    sceneConstraints: string;
  };
  constraints: string[];
  negativeConstraints: string[];
  modelHints: {
    aspectRatio: string;
  };
  finalPrompt: string;
};

export type CliOptions = {
  imageModel: string;
  imageSize: string;
  inputPath: string;
  outputPath?: string;
  userPrompt: string;
  visionModel: string;
};

export type ArtifactPaths = {
  enhancementPath: string;
  imageResponsePath: string;
  promptPath: string;
  requestPath: string;
};
