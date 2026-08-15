import { requireOrganizer } from "@/lib/auth";
import PBBoardTable from "./PBBoardTable";

type PbBoardRow = {
  profile_id: string;
  full_name: string;
  gender: string | null;
  lift_key: string;
  value_numeric: number;
  achieved_date: string;
};

export default async function PBBoardPage() {
  const { supabase } = await requireOrganizer();
  const { data: rows } = await supabase.rpc("get_atg_pb_board");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ATG PB Board</h1>
        <p className="text-ink/60 text-sm mt-1">
          Every ATG athlete&apos;s current best per lift. Filter by lift or gender to call out a PB
          attempt at a live comp.
        </p>
      </div>
      <PBBoardTable rows={(rows ?? []) as PbBoardRow[]} />
    </div>
  );
}
