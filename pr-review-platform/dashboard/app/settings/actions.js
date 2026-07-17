"use server";

import { revalidatePath } from "next/cache";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_KEY = process.env.BACKEND_API_KEY;

export async function setBranchEnabled(branchName, isEnabled) {
  if (!branchName) return;

  const res = await fetch(`${BACKEND_URL}/api/config/branches/${encodeURIComponent(branchName)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ isEnabled }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to update branch "${branchName}" (${res.status}): ${text}`);
  }

  revalidatePath("/settings");
}

export async function addBranch(formData) {
  const branchName = formData.get("branchName")?.toString().trim();
  if (!branchName) return;
  await setBranchEnabled(branchName, true);
}

export async function removeBranch(branchName) {
  const res = await fetch(`${BACKEND_URL}/api/config/branches/${encodeURIComponent(branchName)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to remove branch "${branchName}" (${res.status}): ${text}`);
  }

  revalidatePath("/settings");
}