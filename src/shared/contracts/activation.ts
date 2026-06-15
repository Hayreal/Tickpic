export const ACTIVATION_IPC_CHANNELS = {
  submit: 'activation:submit',
  cancel: 'activation:cancel',
} as const;

export interface ActivationSubmitResult {
  ok: boolean;
  message?: string;
}

declare global {
  interface Window {
    activationShell: {
      submit(code: string): Promise<ActivationSubmitResult>;
      cancel(): Promise<void>;
    };
  }
}

export {};
