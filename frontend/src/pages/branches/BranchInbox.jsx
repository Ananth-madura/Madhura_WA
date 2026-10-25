import { useBranch } from "../../context/BranchContext";
import SharedTeamInbox from "../../components/SharedTeamInbox";

export default function BranchInbox() {
  const { activeBranch } = useBranch();
  return <SharedTeamInbox branchId={activeBranch?.id} />;
}
