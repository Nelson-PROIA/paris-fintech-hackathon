/**
 * Shared shapes for the on-chain contract UI. Mirrors the response of
 * `GET /api/campaign/[id]/contract` so client + server stay in sync.
 */
import type {
  CampaignContractRow,
  ChainEventRow,
  CommitmentRow,
} from "@/lib/db";

export type ContractView = CampaignContractRow & { owed_eur: number };

export type ContractApiResponse = {
  contract: ContractView | null;
  commitments: CommitmentRow[];
  events: ChainEventRow[];
};
