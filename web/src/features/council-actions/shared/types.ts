import type { Database } from "@mirai-gikai/supabase";

export type CouncilAction =
  Database["public"]["Tables"]["council_actions"]["Row"];
