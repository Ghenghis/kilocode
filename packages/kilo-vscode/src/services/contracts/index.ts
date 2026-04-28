/**
 * Contract Markdowns Studio — public service surface.
 *
 * Sprint 1 ships only DocStore + StudioController. The other services
 * listed in `docs/CONTRACT_STUDIO_SPEC.md` (TemplateService, PromptEnhancer,
 * AgenticDocGen, RubricCritic, DiagramService, ResearchService,
 * ScaffoldPipeline, ProviderAdapter, StreamingAggregator) are exported as
 * empty stubs so dependent code can import them without breaking the build.
 */

export { handleContractMessage } from "./StudioController"
export type { StudioControllerContext } from "./StudioController"

export { DocStore, docStore } from "./DocStore"
export type { ContractMeta, ContractDoc, RefsSidecar, RefEntry, SaveResult } from "./DocStore"

// Sprint 2: TemplateService + PromptEnhancer + AgenticDocGen are live.
// Sprint 3+ stubs (RubricCritic etc.) are re-exported as before.
export { TemplateService, templateService, handleTemplateMessage } from "./TemplateService"
export type { Template } from "./TemplateService"
export { PromptEnhancer, KNOWN_DOMAIN_IDS } from "./PromptEnhancer"
export type {
  ClarifyingQuestion,
  EnrichedIntent,
  EnrichedConstraint,
  AmbiguityReport,
  DomainPack,
} from "./PromptEnhancer"
export { AgenticDocGen } from "./AgenticDocGen"
export type { DocGenRequest, SectionDelta } from "./AgenticDocGen"
export { RubricCritic } from "./RubricCritic"
export { DiagramService } from "./DiagramService"
export { ResearchService } from "./ResearchService"
export { ScaffoldPipeline } from "./ScaffoldPipeline"
export { ProviderAdapter } from "./ProviderAdapter"
export { StreamingAggregator } from "./StreamingAggregator"
