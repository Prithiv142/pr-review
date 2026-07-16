import { getBranchConfigs } from "../../lib/api";
import { addBranch, setBranchEnabled, removeBranch } from "./actions";

export const dynamic = "force-dynamic"; // always show current config, never cache

export default async function SettingsPage() {
  const branches = await getBranchConfigs();

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>Review settings</h1>
      <p style={{ color: "#9aa0aa", maxWidth: 560 }}>
        Only branches listed here and marked enabled will have PRs targeting them
        automatically reviewed. New branches default to disabled until added here.
      </p>

      <table style={{ maxWidth: 640, margin: "16px 0" }}>
        <thead>
          <tr>
            <th>Target branch</th>
            <th>Enabled</th>
            <th>Last updated</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => (
            <tr key={b.branchName}>
              <td>{b.branchName}</td>
              <td>
                <form
                  action={async () => {
                    "use server";
                    await setBranchEnabled(b.branchName, !b.isEnabled);
                  }}
                >
                  <button type="submit">{b.isEnabled ? "Enabled ✅" : "Disabled ⛔"}</button>
                </form>
              </td>
              <td>{new Date(b.updatedAt).toLocaleString()}</td>
              <td>
                <form
                  action={async () => {
                    "use server";
                    await removeBranch(b.branchName);
                  }}
                >
                  <button type="submit" style={{ color: "#e5484d" }}>
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {branches.length === 0 && (
            <tr>
              <td colSpan={4} style={{ color: "#9aa0aa" }}>
                No branches configured yet — add one below.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form action={addBranch} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input name="branchName" placeholder="e.g. Dev" required />
        <button type="submit">Add branch (enabled)</button>
      </form>
    </div>
  );
}
