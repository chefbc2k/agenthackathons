import { z } from "zod";

import { createParser } from "./parse-result.js";

export const a2aAgentCardSignatureMetadataSchema = z
  .object({
    algorithm: z.string().min(1).optional(),
    keyId: z.string().min(1).optional(),
    protectedHeader: z.string().min(1).optional(),
    signature: z.string().min(1).optional(),
  })
  .strict();

export const a2aAgentCardCapabilitySchema = z
  .object({
    pushNotifications: z.boolean().optional(),
    stateTransitionHistory: z.boolean().optional(),
    streaming: z.boolean().optional(),
  })
  .strict();

export const a2aAgentCardSkillSchema = z
  .object({
    description: z.string().min(1).optional(),
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    tags: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const a2aAgentCardExtensionSchema = z
  .object({
    description: z.string().min(1).optional(),
    required: z.boolean().optional(),
    uri: z.string().min(1),
  })
  .strict();

export const a2aAgentCardProviderSchema = z
  .object({
    organization: z.string().min(1).optional(),
    url: z.string().url().optional(),
  })
  .strict();

export const a2aAgentCardSchema = z
  .object({
    capabilities: a2aAgentCardCapabilitySchema.optional(),
    defaultInputModes: z.array(z.string().min(1)).optional(),
    defaultOutputModes: z.array(z.string().min(1)).optional(),
    description: z.string().min(1).optional(),
    documentationUrl: z.string().url().optional(),
    extensions: z.array(a2aAgentCardExtensionSchema).optional(),
    name: z.string().min(1),
    provider: a2aAgentCardProviderSchema.optional(),
    signatures: z.array(a2aAgentCardSignatureMetadataSchema).optional(),
    skills: z.array(a2aAgentCardSkillSchema).optional(),
    url: z.string().url(),
  })
  .strict();

export type A2aAgentCard = z.infer<typeof a2aAgentCardSchema>;
export type A2aAgentCardCapability = z.infer<
  typeof a2aAgentCardCapabilitySchema
>;
export type A2aAgentCardExtension = z.infer<typeof a2aAgentCardExtensionSchema>;
export type A2aAgentCardProvider = z.infer<typeof a2aAgentCardProviderSchema>;
export type A2aAgentCardSignatureMetadata = z.infer<
  typeof a2aAgentCardSignatureMetadataSchema
>;
export type A2aAgentCardSkill = z.infer<typeof a2aAgentCardSkillSchema>;

export interface NormalizedA2aAgentCardCapability {
  readonly pushNotifications: boolean;
  readonly stateTransitionHistory: boolean;
  readonly streaming: boolean;
}

export interface NormalizedA2aAgentCardExtension {
  readonly description: string | null;
  readonly required: boolean;
  readonly uri: string;
}

export interface NormalizedA2aAgentCardProvider {
  readonly organization: string | null;
  readonly url: string | null;
}

export interface NormalizedA2aAgentCardSignatureMetadata {
  readonly algorithm: string | null;
  readonly keyId: string | null;
  readonly protectedHeader: string | null;
  readonly signature: string | null;
}

export interface NormalizedA2aAgentCardSkill {
  readonly description: string | null;
  readonly id: string;
  readonly name: string | null;
  readonly tags: readonly string[];
}

export interface NormalizedA2aAgentCard {
  readonly agentCardUrl: string;
  readonly capabilities: NormalizedA2aAgentCardCapability;
  readonly defaultInputModes: readonly string[];
  readonly defaultOutputModes: readonly string[];
  readonly description: string | null;
  readonly documentationUrl: string | null;
  readonly extensions: readonly NormalizedA2aAgentCardExtension[];
  readonly name: string;
  readonly provider: NormalizedA2aAgentCardProvider | null;
  readonly signatureMetadata: readonly NormalizedA2aAgentCardSignatureMetadata[];
  readonly skills: readonly NormalizedA2aAgentCardSkill[];
}

export const normalizeA2aAgentCard = (
  agentCard: A2aAgentCard,
): NormalizedA2aAgentCard => {
  return {
    agentCardUrl: agentCard.url,
    capabilities: {
      pushNotifications: agentCard.capabilities?.pushNotifications ?? false,
      stateTransitionHistory:
        agentCard.capabilities?.stateTransitionHistory ?? false,
      streaming: agentCard.capabilities?.streaming ?? false,
    },
    defaultInputModes: agentCard.defaultInputModes ?? [],
    defaultOutputModes: agentCard.defaultOutputModes ?? [],
    description: agentCard.description ?? null,
    documentationUrl: agentCard.documentationUrl ?? null,
    extensions:
      agentCard.extensions?.map((extension) => ({
        description: extension.description ?? null,
        required: extension.required ?? false,
        uri: extension.uri,
      })) ?? [],
    name: agentCard.name,
    provider: agentCard.provider
      ? {
          organization: agentCard.provider.organization ?? null,
          url: agentCard.provider.url ?? null,
        }
      : null,
    signatureMetadata:
      agentCard.signatures?.map((signature) => ({
        algorithm: signature.algorithm ?? null,
        keyId: signature.keyId ?? null,
        protectedHeader: signature.protectedHeader ?? null,
        signature: signature.signature ?? null,
      })) ?? [],
    skills:
      agentCard.skills?.map((skill) => ({
        description: skill.description ?? null,
        id: skill.id,
        name: skill.name ?? null,
        tags: skill.tags ?? [],
      })) ?? [],
  };
};

export const parseA2aAgentCard = createParser(
  a2aAgentCardSchema,
  normalizeA2aAgentCard,
);
